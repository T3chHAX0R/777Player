package io.github.t3chhax0r.player777

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.ComponentName
import android.content.Intent
import android.content.MutableContextWrapper
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

/**
 * 網頁介面 ⇄ 原生播放器 的中繼站（整個 App 行程只有一個）。
 *
 * - WebView 用 MutableContextWrapper 建立：畫面（Activity）關掉後 WebView 仍存活，
 *   背景播完一首時網頁還能決定並解析下一首。
 * - JS 透過 window.AndroidPlayer 呼叫原生；原生透過 window.__nativePlayer.emit 回報狀態。
 */
class PlayerHub(private val app: App) {
    private val main = Handler(Looper.getMainLooper())
    private val ctx = MutableContextWrapper(app)
    private var activity: Activity? = null

    private var controller: MediaController? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private val pending = mutableListOf<(MediaController) -> Unit>()
    @Volatile private var lastState = "{}"

    val webView: WebView by lazy { createWebView() }

    /* ---------- 畫面接上／離開 ---------- */
    fun attach(a: Activity): WebView {
        activity = a
        ctx.baseContext = a // 下拉選單、對話框需要 Activity 的 context
        (webView.parent as? ViewGroup)?.removeView(webView)
        connect()
        return webView
    }

    fun detach(a: Activity) {
        if (activity !== a) return
        (webView.parent as? ViewGroup)?.removeView(webView)
        ctx.baseContext = app
        activity = null
    }

    /* ---------- 連接播放服務 ---------- */
    fun connect() = withController { }

    private fun withController(block: (MediaController) -> Unit) {
        controller?.let { block(it); return }
        pending += block
        if (controllerFuture != null) return
        val token = SessionToken(app, ComponentName(app, PlaybackService::class.java))
        val future = MediaController.Builder(app, token).buildAsync()
        controllerFuture = future
        future.addListener({
            try {
                val c = future.get()
                controller = c
                c.addListener(listener)
                pending.toList().forEach { it(c) }
                pending.clear()
                sendState()
            } catch (e: Exception) {
                controllerFuture = null
                pending.clear()
            }
        }, ContextCompat.getMainExecutor(app))
    }

    /* ---------- 原生 → 網頁 ---------- */
    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            if (events.containsAny(
                    Player.EVENT_IS_PLAYING_CHANGED,
                    Player.EVENT_PLAYBACK_STATE_CHANGED,
                    Player.EVENT_PLAY_WHEN_READY_CHANGED,
                )
            ) {
                sendState()
                if (player.isPlaying) startTicker()
            }
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int,
        ) {
            if (reason == Player.DISCONTINUITY_REASON_SEEK) emit("seeked", positionJson())
        }

        override fun onPlayerError(error: PlaybackException) {
            // 對應 HTML MediaError：2 = 網路（含網址過期 403），4 = 格式不支援
            val code = if (error.errorCode in 2000..2999) 2 else if (error.errorCode in 3000..4999) 4 else 2
            emit("error", JSONObject().put("code", code).put("message", error.errorCodeName).toString())
        }
    }

    private val ticker = object : Runnable {
        override fun run() {
            val c = controller ?: return
            if (!c.isPlaying) return
            emit("time", positionJson())
            main.postDelayed(this, 500)
        }
    }

    private fun startTicker() {
        main.removeCallbacks(ticker)
        main.post(ticker)
    }

    private fun positionJson(): String {
        val c = controller ?: return "{}"
        val dur = if (c.duration == C.TIME_UNSET) -1.0 else c.duration / 1000.0
        return JSONObject().put("pos", c.currentPosition / 1000.0).put("dur", dur).toString()
    }

    private fun sendState() {
        val c = controller ?: return
        val dur = if (c.duration == C.TIME_UNSET) -1.0 else c.duration / 1000.0
        val json = JSONObject()
            .put("playing", c.isPlaying)
            .put("pwr", c.playWhenReady)
            .put("st", c.playbackState)
            .put("pos", c.currentPosition / 1000.0)
            .put("dur", dur)
            .toString()
        lastState = json
        emit("state", json)
    }

    /** 通知列／耳機的上一首、下一首（由 QueueBridgePlayer 呼叫） */
    fun sendCommand(cmd: String) {
        main.post { emit("command", JSONObject().put("cmd", cmd).toString()) }
    }

    private fun emit(type: String, json: String) {
        val js = "window.__nativePlayer&&window.__nativePlayer.emit(${JSONObject.quote(type)},$json)"
        main.post { webView.evaluateJavascript(js, null) }
    }

    /* ---------- 網頁 → 原生（window.AndroidPlayer） ---------- */
    inner class Bridge {
        @JavascriptInterface
        fun load(json: String) {
            main.post {
                val o = JSONObject(json)
                val meta = MediaMetadata.Builder()
                    .setTitle(o.optString("title"))
                    .setArtist(o.optString("artist"))
                    .setAlbumTitle(o.optString("album"))
                    .apply { o.optString("art").takeIf { it.isNotEmpty() }?.let { setArtworkUri(Uri.parse(it)) } }
                    .build()
                val item = MediaItem.Builder()
                    .setUri(o.getString("url"))
                    .setMediaId(o.optString("id", o.getString("url")))
                    .setMediaMetadata(meta)
                    .build()
                withController { c ->
                    c.setMediaItem(item, o.optLong("startMs", 0L))
                    c.prepare()
                    c.playWhenReady = o.optBoolean("play", false)
                }
            }
        }

        @JavascriptInterface
        fun play() { main.post { withController { it.play() } } }

        @JavascriptInterface
        fun pause() { main.post { withController { it.pause() } } }

        @JavascriptInterface
        fun seekTo(ms: Double) { main.post { withController { it.seekTo(ms.toLong().coerceAtLeast(0)) } } }

        @JavascriptInterface
        fun stop() { main.post { withController { it.stop(); it.clearMediaItems() } } }

        @JavascriptInterface
        fun getState(): String = lastState

        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME
    }

    /* ---------- WebView ---------- */
    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun createWebView(): WebView = WebView(ctx).apply {
        setBackgroundColor(0xFF0E1014.toInt())
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.userAgentString = settings.userAgentString + " 777PlayerApp/" + BuildConfig.VERSION_NAME
        addJavascriptInterface(Bridge(), "AndroidPlayer")

        webViewClient = object : WebViewClient() {
            // 只有 777Player 自己的網址在 App 內開，其他連結交給瀏覽器
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.host == SITE_HOST && (u.path ?: "").startsWith(SITE_PATH)) return false
                try {
                    view.context.startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) { }
                return true
            }
        }

        webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
                val a = activity ?: run { result.cancel(); return true }
                AlertDialog.Builder(a)
                    .setMessage(message)
                    .setPositiveButton("確定") { _, _ -> result.confirm() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
                val a = activity ?: run { result.cancel(); return true }
                AlertDialog.Builder(a)
                    .setMessage(message)
                    .setPositiveButton("確定") { _, _ -> result.confirm() }
                    .setNegativeButton("取消") { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }
        }

        loadUrl(SITE_URL)
    }

    companion object {
        const val SITE_URL = "https://t3chhax0r.github.io/777Player/"
        const val SITE_HOST = "t3chhax0r.github.io"
        const val SITE_PATH = "/777Player"
    }
}
