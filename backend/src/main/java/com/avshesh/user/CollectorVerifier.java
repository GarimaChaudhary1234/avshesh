package com.avshesh.user;

/** Lets the municipal corporation approve or reject a scrap dealer or compost center. */
public interface CollectorVerifier {

    void setStatus(long collectorId, VerificationStatus status);
}
