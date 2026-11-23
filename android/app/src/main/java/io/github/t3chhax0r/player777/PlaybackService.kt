package io.github.t3chhax0r.player777

import android.app.PendingIntent
import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * 原生播放服務（Media3）。
 * - 音訊焦點交給 ExoPlayer 自動處理：來電、導航語音時暫停，結束後自動恢復
 * - 拔耳機／藍芽斷線時自動暫停（becoming noisy）
 * - 播放中是前景服務，系統不會把 App 回收
 * - 通知列、鎖屏、耳機與藍芽按鍵都透過 MediaSession 送進來
 */
class PlaybackService : MediaSessionService() {
    private var session: MediaSession? = null

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()
        val exo = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true,
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()

        val openApp = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        session = MediaSession.Builder(this, QueueBridgePlayer(exo))
            .setSessionActivity(openApp)
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    // 從最近使用清單滑掉 App 時：沒在播就結束服務；正在播就繼續（跟一般音樂 App 一樣）
    override fun onTaskRemoved(rootIntent: Intent?) {
        val p = session?.player
        if (p == null || !p.playWhenReady || p.mediaItemCount == 0 || p.playbackState == Player.STATE_ENDED) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        session?.run {
            player.release()
            release()
        }
        session = null
        super.onDestroy()
    }
}

/**
 * 播放佇列在網頁端管理，原生播放器一次只放一首。
 * 這個包裝讓通知列與耳機顯示「上一首／下一首」，按下時轉給網頁處理。
 */
class QueueBridgePlayer(player: Player) : ForwardingPlayer(player) {
    private val extra = listOf(
        Player.COMMAND_SEEK_TO_NEXT,
        Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
        Player.COMMAND_SEEK_TO_PREVIOUS,
        Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
    )

    override fun getAvailableCommands(): Player.Commands =
        super.getAvailableCommands().buildUpon().addAll(*extra.toIntArray()).build()

    override fun isCommandAvailable(command: Int): Boolean =
        command in extra || super.isCommandAvailable(command)

    override fun hasNextMediaItem(): Boolean = true
    override fun hasPreviousMediaItem(): Boolean = true

    override fun seekToNext() = App.instance.hub.sendCommand("next")
    override fun seekToNextMediaItem() = App.instance.hub.sendCommand("next")
    override fun seekToPrevious() = App.instance.hub.sendCommand("prev")
    override fun seekToPreviousMediaItem() = App.instance.hub.sendCommand("prev")
}
