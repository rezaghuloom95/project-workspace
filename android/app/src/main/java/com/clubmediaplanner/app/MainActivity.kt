package com.clubmediaplanner.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private val plannerUrl by lazy { getString(R.string.planner_url).trimEnd('/') }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.parseColor("#163D33")
        window.navigationBarColor = Color.WHITE

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#F5F6F4"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            settings.mediaPlaybackRequiresUserGesture = true
            webChromeClient = WebChromeClient()
            webViewClient = PlannerWebViewClient(plannerUrl)
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        setContentView(webView)

        createNotificationChannel()
        requestNotificationPermissionWhenNeeded()
        loadIntent(intent)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadIntent(intent)
    }

    override fun onPause() {
        webView.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    private fun loadIntent(intent: Intent?) {
        val deepLink = intent?.data
        val target = if (deepLink?.scheme == "clubmediaplanner" && deepLink.host == "event") {
            val eventId = deepLink.lastPathSegment.orEmpty()
            "$plannerUrl/?event=${Uri.encode(eventId)}"
        } else {
            plannerUrl
        }
        webView.loadUrl(target)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    "club_planner_updates",
                    getString(R.string.notification_channel_name),
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = getString(R.string.notification_channel_description)
                    enableVibration(true)
                }
            )
        }
    }

    private fun requestNotificationPermissionWhenNeeded() {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                NOTIFICATION_PERMISSION_REQUEST
            )
        }
    }

    companion object {
        private const val NOTIFICATION_PERMISSION_REQUEST = 1201
    }
}

private class PlannerWebViewClient(
    private val plannerOrigin: String
) : WebViewClient() {
    override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest
    ): Boolean {
        val url = request.url.toString()
        if (url.startsWith(plannerOrigin) || url.contains("signin-with-chatgpt")) {
            return false
        }
        view.context.startActivity(Intent(Intent.ACTION_VIEW, request.url))
        return true
    }
}
