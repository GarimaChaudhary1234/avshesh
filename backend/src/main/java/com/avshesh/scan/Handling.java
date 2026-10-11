package com.avshesh.scan;

/** Where a kind of waste has to go. Drives what the household is shown after a scan. */
public enum Handling {
    /** Resold by a scrap dealer, collected through a Mohalla Pool. */
    SELL_TO_DEALER,
    /** Turned into compost, collected through a Mohalla Pool. */
    COMPOST,
    /** Not recyclable: the household asks the municipal corporation to collect it. */
    MUNICIPAL_PICKUP,
    /** Hazardous: must be handed in at an authorised drop-off point. */
    DROP_OFF_POINT
}
