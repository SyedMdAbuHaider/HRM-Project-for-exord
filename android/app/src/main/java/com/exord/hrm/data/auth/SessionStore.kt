package com.exord.hrm.data.auth
import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.sessionStore by preferencesDataStore("exord_session")
class SessionStore(private val context:Context){
 private val access=stringPreferencesKey("access_token")
 private val refresh=stringPreferencesKey("refresh_token")
 suspend fun save(a:String,r:String)=context.sessionStore.edit{it[access]=a;it[refresh]=r}
 suspend fun accessToken():String=context.sessionStore.data.first()[access].orEmpty()
 suspend fun clear()=context.sessionStore.edit{it.remove(access);it.remove(refresh)}
}