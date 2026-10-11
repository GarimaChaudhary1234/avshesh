package com.avshesh;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AvsheshApplication {

	/**
	 * Users enter pickup times in local time and the database stores them without a zone, so the whole
	 * application must run in one business time zone. Without this a container runs in UTC and "now" is 5.5
	 * hours behind India: past pickup times are accepted and the monthly earnings roll over at the wrong hour.
	 */
	static final String DEFAULT_TIME_ZONE = "Asia/Kolkata";

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone(System.getenv().getOrDefault("APP_TIMEZONE", DEFAULT_TIME_ZONE)));
		SpringApplication.run(AvsheshApplication.class, args);
	}

}
