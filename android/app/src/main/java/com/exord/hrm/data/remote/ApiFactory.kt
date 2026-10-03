package com.exord.hrm.data.remote
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import kotlinx.serialization.json.Json
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import okhttp3.MediaType.Companion.toMediaType

class AuthInterceptor(private val tokenProvider:()->String):Interceptor{
 override fun intercept(chain:Interceptor.Chain):okhttp3.Response{
  val token=tokenProvider(); val req=chain.request().newBuilder()
  if(token.isNotBlank()) req.header("Authorization","Bearer $token")
  return chain.proceed(req.build())
 }
}
object ApiFactory {
 val BASE_URL: String get() = BuildConfig.HRM_API_URL
 fun create(tokenProvider:()->String):HrmApi{
  val json=Json{ignoreUnknownKeys=true}
  val client=OkHttpClient.Builder().addInterceptor(AuthInterceptor(tokenProvider)).build()
  return Retrofit.Builder().baseUrl(BASE_URL).client(client).addConverterFactory(json.asConverterFactory("application/json".toMediaType())).build().create(HrmApi::class.java)
 }
}