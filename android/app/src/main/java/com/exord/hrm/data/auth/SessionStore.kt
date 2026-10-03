package com.exord.hrm.data.auth
import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SessionStore(context:Context){
 private val prefs=EncryptedSharedPreferences.create(
  context,"exord_hrm_session",
  MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
  EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
  EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
 )
 fun save(access:String,refresh:String){prefs.edit().putString("access_token",access).putString("refresh_token",refresh).apply()}
 fun accessToken():String=prefs.getString("access_token","").orEmpty()
 fun refreshToken():String=prefs.getString("refresh_token","").orEmpty()
 fun clear(){prefs.edit().clear().apply()}
}