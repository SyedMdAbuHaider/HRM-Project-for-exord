package com.exord.hrm.ui
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.exord.hrm.data.auth.SessionStore
import com.exord.hrm.data.remote.ApiFactory
import com.exord.hrm.data.remote.LoginRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HrmState(val loggedIn:Boolean=false,val name:String="",val role:String="",val loading:Boolean=false,val error:String?=null)
class HrmViewModel(app:Application):AndroidViewModel(app){
 private val sessions=SessionStore(app)
 private val api=ApiFactory.create{currentToken}
 private var currentToken=""
 var identifier=""; var password=""
 private val _state=MutableStateFlow(HrmState()); val state=_state.asStateFlow()
 init{viewModelScope.launch{currentToken=sessions.accessToken();if(currentToken.isNotBlank())bootstrap()}}
 fun login(){viewModelScope.launch{_state.value=HrmState(loading=true);try{val r=api.login(LoginRequest(identifier.trim(),password));currentToken=r.accessToken;sessions.save(r.accessToken,r.refreshToken);bootstrap()}catch(e:Exception){_state.value=HrmState(error=e.message?:"Unable to sign in")}}}
 private suspend fun bootstrap(){try{val me=api.me().data;_state.value=HrmState(loggedIn=me!=null,name=me?.full_name.orEmpty(),role=me?.role.orEmpty())}catch(e:Exception){sessions.clear();currentToken="";_state.value=HrmState(error="Session expired")}}
 fun logout(){viewModelScope.launch{sessions.clear();currentToken="";_state.value=HrmState()}}
 companion object{fun factory(app:Application)=object:androidx.lifecycle.ViewModelProvider.Factory{override fun <T:androidx.lifecycle.ViewModel> create(modelClass:Class<T>):T=HrmViewModel(app) as T}}
}