package com.avshesh.scan;

public enum Category {
    DRY(Handling.SELL_TO_DEALER),
    WET(Handling.COMPOST),
    /** Dust, sweepings, soiled or mixed waste: nobody buys it, the municipality collects it. */
    GENERAL(Handling.MUNICIPAL_PICKUP),
    /** Batteries, bulbs, medicines, electronics: never to a scrap dealer, only to a drop-off point. */
    HAZARDOUS(Handling.DROP_OFF_POINT);

    private final Handling handling;

    Category(Handling handling) {
        this.handling = handling;
    }

    public Handling handling() {
        return handling;
    }

    /** True if this waste can be pooled and collected by a scrap dealer or compost center. */
    public boolean isPoolable() {
        return handling == Handling.SELL_TO_DEALER || handling == Handling.COMPOST;
    }
}
