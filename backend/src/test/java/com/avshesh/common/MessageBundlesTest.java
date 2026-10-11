package com.avshesh.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;

/** The three languages must say the same things: same keys, same {0} placeholders, no stray quotes. */
class MessageBundlesTest {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\d+)\\}");
    private static final Map<String, String> FILES = Map.of("hi", "messages_hi.properties", "or", "messages_or.properties");

    private static Properties load(String name) throws Exception {
        Properties p = new Properties();
        try (Reader in = new InputStreamReader(MessageBundlesTest.class.getResourceAsStream("/" + name), StandardCharsets.UTF_8)) {
            p.load(in);
        }
        return p;
    }

    private static Set<String> placeholders(String text) {
        Set<String> found = new TreeSet<>();
        Matcher m = PLACEHOLDER.matcher(text);
        while (m.find()) {
            found.add(m.group(1));
        }
        return found;
    }

    @Test
    void everyLanguageHasEveryKey() throws Exception {
        Properties en = load("messages.properties");
        for (var e : FILES.entrySet()) {
            Properties other = load(e.getValue());
            assertEquals(new TreeSet<>(en.stringPropertyNames()), new TreeSet<>(other.stringPropertyNames()),
                    e.getKey() + " must have exactly the same keys as English");
        }
    }

    @Test
    void placeholdersMatchEnglish() throws Exception {
        Properties en = load("messages.properties");
        for (var e : FILES.entrySet()) {
            Properties other = load(e.getValue());
            for (String key : en.stringPropertyNames()) {
                assertEquals(placeholders(en.getProperty(key)), placeholders(other.getProperty(key)),
                        e.getKey() + " placeholders differ for " + key);
            }
        }
    }

    @Test
    void messagesWithPlaceholdersHaveNoQuoteThatMessageFormatWouldEat() throws Exception {
        for (String name : new String[] {"messages.properties", "messages_hi.properties", "messages_or.properties"}) {
            Properties p = load(name);
            for (String key : p.stringPropertyNames()) {
                String text = p.getProperty(key);
                if (!placeholders(text).isEmpty()) {
                    assertFalse(text.contains("'"), name + " " + key + " has an ASCII apostrophe next to placeholders");
                }
            }
        }
    }

    @Test
    void translationsAreActuallyTranslated() throws Exception {
        Properties en = load("messages.properties");
        Properties hi = load("messages_hi.properties");
        Properties or = load("messages_or.properties");
        for (String key : en.stringPropertyNames()) {
            assertTrue(hi.getProperty(key).codePoints().anyMatch(c -> c >= 0x0900 && c <= 0x097F),
                    "Hindi text for " + key + " has no Devanagari letters");
            assertTrue(or.getProperty(key).codePoints().anyMatch(c -> c >= 0x0B00 && c <= 0x0B7F),
                    "Odia text for " + key + " has no Odia letters");
        }
    }
}
