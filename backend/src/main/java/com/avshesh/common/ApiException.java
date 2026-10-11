package com.avshesh.common;

import org.springframework.http.HttpStatus;

/**
 * An error the caller can fix. {@code message} is the English text. When a {@code code} is given, the handler
 * looks it up in the message bundles (messages_hi, messages_or, ...) for the caller's language and falls back to
 * the English text, so errors can be translated one by one without touching the code that throws them.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final transient Object[] args;

    public ApiException(HttpStatus status, String message) {
        this(status, null, message);
    }

    public ApiException(HttpStatus status, String code, String message, Object... args) {
        super(message);
        this.status = status;
        this.code = code;
        this.args = args;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    public static ApiException badRequest(String code, String message, Object... args) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message, args);
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }

    public static ApiException notFound(String code, String message, Object... args) {
        return new ApiException(HttpStatus.NOT_FOUND, code, message, args);
    }

    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }

    public static ApiException conflict(String code, String message, Object... args) {
        return new ApiException(HttpStatus.CONFLICT, code, message, args);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, message);
    }

    public static ApiException unauthorized(String code, String message, Object... args) {
        return new ApiException(HttpStatus.UNAUTHORIZED, code, message, args);
    }

    public static ApiException tooManyRequests(String message) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, message);
    }

    public static ApiException tooManyRequests(String code, String message, Object... args) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, code, message, args);
    }

    public static ApiException badGateway(String message) {
        return new ApiException(HttpStatus.BAD_GATEWAY, message);
    }

    public static ApiException badGateway(String code, String message, Object... args) {
        return new ApiException(HttpStatus.BAD_GATEWAY, code, message, args);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message);
    }

    public static ApiException forbidden(String code, String message, Object... args) {
        return new ApiException(HttpStatus.FORBIDDEN, code, message, args);
    }

    public HttpStatus getStatus() {
        return status;
    }

    /** Message bundle key, or null for errors that are only available in English. */
    public String getCode() {
        return code;
    }

    public Object[] getArgs() {
        return args == null ? new Object[0] : args;
    }
}
