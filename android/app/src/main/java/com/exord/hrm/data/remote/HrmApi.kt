package com.exord.hrm.data.remote
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.POST

@Serializable data class LoginRequest(val identifier:String,val password:String)
@Serializable data class LoginResponse(val accessToken:String,val refreshToken:String,val expiresIn:Int,val mustChangePassword:Boolean=false)
@Serializable data class ApiError(val error:String)
interface HrmApi {
 @POST("api/v1/auth/login") suspend fun login(@Body request:LoginRequest): LoginResponse
}