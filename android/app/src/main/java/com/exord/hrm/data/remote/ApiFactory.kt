package com.exord.hrm.data.remote
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import kotlinx.serialization.json.Json
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType

class AuthInterceptor(private val tokenProvider:()->String):Interceptor{
 override fun intercept(chain:Interceptor.Chain):okhttp3.Response{
  val req=chain.request().newBuilder()
  tokenProvider().takeIf{it.isNotBlank()}?.let{req.header("Authorization","Bearer $it")}
  return chain.proceed(req.build())
 }
}
object ApiFactory{
 private fun refreshToken(api:HrmApi,tokenProvider:()->String,refreshProvider:()->String,save:(String,String)->Unit):Boolean{
  val refresh=refreshProvider(); if(refresh.isBlank()) return false
  return try{val r=runBlocking{api.refresh(RefreshRequest(refresh))};save(r.accessToken,r.refreshToken);true}catch(_:Exception){false}
 }
 val BASE_URL:String get()=BuildConfig.HRM_API_URL
 fun create(tokenProvider:()->String,refreshProvider:()->String={""},saveTokens:(String,String)->Unit={_,_->},clearSession:()->Unit={}):HrmApi{
  val json=Json{ignoreUnknownKeys=true}
  lateinit var api:HrmApi
  val client=OkHttpClient.Builder().addInterceptor(Interceptor{chain->
   val response=chain.proceed(chain.request().newBuilder().apply{tokenProvider().takeIf{it.isNotBlank()}?.let{header("Authorization","Bearer $it")}}.build())
   if(response.code!=401||chain.request().url.encodedPath.contains("/auth/refresh")) return@Interceptor response
   response.close()
   if(!refreshToken(api,tokenProvider,refreshProvider,saveTokens)){clearSession();return@Interceptor response}
   chain.proceed(chain.request().newBuilder().header("Authorization","Bearer ${tokenProvider()}").build())
  }).build()
  api=Retrofit.Builder().baseUrl(BASE_URL).client(client).addConverterFactory(json.asConverterFactory("application/json".toMediaType())).build().create(HrmApi::class.java)
  return api
 }
}