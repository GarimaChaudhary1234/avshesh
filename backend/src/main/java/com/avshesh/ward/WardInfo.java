package com.avshesh.ward;

/** What other modules and the frontend may know about a ward (the boundary stays inside this module). */
public record WardInfo(Long id, String city, String wardNo, String zone, Integer households, Integer population,
                       String label) {

    static WardInfo from(Ward w) {
        String number = w.getWardNo().replaceFirst("^[A-Za-z]+", "");
        String label = "Ward " + number + (w.getZone() == null ? "" : " · " + w.getZone()) + ", " + w.getCity();
        return new WardInfo(w.getId(), w.getCity(), w.getWardNo(), w.getZone(), w.getHouseholds(), w.getPopulation(),
                label);
    }
}
