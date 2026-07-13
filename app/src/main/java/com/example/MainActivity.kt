package com.example

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {

    private val createDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/zip")
    ) { uri ->
        uri?.let {
            saveZipToUri(it)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            useWideViewPort = true
                            loadWithOverviewMode = true
                            databaseEnabled = true
                            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                        }
                        webViewClient = WebViewClient()
                        webChromeClient = WebChromeClient()
                        addJavascriptInterface(WebAppInterface(this@MainActivity), "AndroidBridge")
                        loadUrl("file:///android_asset/www/index.html")
                    }
                }
            )
        }
    }

    fun openFilePicker() {
        try {
            createDocumentLauncher.launch("web_project.zip")
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Could not open file picker: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveZipToUri(uri: Uri) {
        try {
            contentResolver.openOutputStream(uri)?.use { outputStream ->
                assets.open("www/web_project.zip").use { inputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
            Toast.makeText(this, "Saved web_project.zip successfully!", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to save file: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}

class WebAppInterface(private val activity: MainActivity) {
    
    @JavascriptInterface
    fun downloadZip() {
        activity.runOnUiThread {
            try {
                val options = arrayOf("Save to Device (using File Picker)", "Share / Send File to App")
                AlertDialog.Builder(activity)
                    .setTitle("Download Web Project")
                    .setItems(options) { _, which ->
                        when (which) {
                            0 -> activity.openFilePicker()
                            1 -> shareZip()
                        }
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
            } catch (e: Exception) {
                e.printStackTrace()
                shareZip()
            }
        }
    }

    private fun shareZip() {
        try {
            // Copy web_project.zip from assets to cache directory to share it
            val cacheFile = File(activity.cacheDir, "web_project.zip")
            activity.assets.open("www/web_project.zip").use { input ->
                FileOutputStream(cacheFile).use { output ->
                    input.copyTo(output)
                }
            }
            
            // Share the file
            val authority = "${activity.packageName}.fileprovider"
            val uri = FileProvider.getUriForFile(activity, authority, cacheFile)
            
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/zip"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooserIntent = Intent.createChooser(intent, "Save or share Web Project ZIP")
            activity.startActivity(chooserIntent)
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(activity, "Failed to share: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
}
