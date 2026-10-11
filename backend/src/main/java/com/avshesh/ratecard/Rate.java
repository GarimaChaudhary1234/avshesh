package com.avshesh.ratecard;

/** One item's rates for one collector, in Rs/kg. The RateCard entity stays inside this module. */
public record Rate(String itemCode, double buyRate, double sellRate) {

    public double margin() {
        return sellRate - buyRate;
    }
}
