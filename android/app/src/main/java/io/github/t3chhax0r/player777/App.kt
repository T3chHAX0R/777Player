package io.github.t3chhax0r.player777

import android.app.Application

/** 整個 App 行程共用一個 PlayerHub：WebView 與播放控制在畫面關掉後仍然活著。 */
class App : Application() {
    val hub: PlayerHub by lazy { PlayerHub(this) }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: App
            private set
    }
}
