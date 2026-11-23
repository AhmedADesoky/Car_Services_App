package com.carservices.core.network

import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>
    /** The server answered with an error, e.g. code = "INVALID_CREDENTIALS". */
    data class Failure(val problem: Problem) : ApiResult<Nothing>
    /** No connection to the server at all. */
    data object NetworkError : ApiResult<Nothing>
}

private val problemJson = Json { ignoreUnknownKeys = true }

/** Wraps a suspend API call and turns exceptions into ApiResult. */
suspend fun <T> apiCall(block: suspend () -> T): ApiResult<T> = try {
    ApiResult.Success(block())
} catch (error: HttpException) {
    val body = error.response()?.errorBody()?.string()
    val problem = body?.let { runCatching { problemJson.decodeFromString<Problem>(it) }.getOrNull() }
    ApiResult.Failure(problem ?: Problem(code = "HTTP_${error.code()}", status = error.code()))
} catch (_: IOException) {
    ApiResult.NetworkError
}
