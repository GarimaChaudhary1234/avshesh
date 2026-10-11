package com.avshesh.sms;

/** Sends a text message to a mobile number (10 digits, no country code). */
public interface SmsSender {
    void send(String phone, String text);
}
