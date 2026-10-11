package com.avshesh.seed;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.avshesh.listing.ListingMode;
import com.avshesh.listing.ListingService;
import com.avshesh.listing.ListingService.CreateRequest;
import com.avshesh.listing.PickupInfoProvider;
import com.avshesh.municipal.ActivityLog;
import com.avshesh.municipal.CollectionPointService;
import com.avshesh.municipal.CollectionPointService.PointInput;
import com.avshesh.municipal.MunicipalRequestService;
import com.avshesh.municipal.MunicipalRequestService.NewRequest;
import com.avshesh.municipal.MunicipalRequestService.StatusUpdate;
import com.avshesh.municipal.MunicipalStaffService;
import com.avshesh.municipal.MunicipalStaffService.StaffInput;
import com.avshesh.municipal.MunicipalStaffService.StaffView;
import com.avshesh.municipal.RequestStatus;
import com.avshesh.pickup.PaymentConfirmationService;
import com.avshesh.pickup.PaymentMode;
import com.avshesh.pickup.PickupQueryService.PickupView;
import com.avshesh.pickup.PickupScheduler;
import com.avshesh.pickup.StopCompletionService;
import com.avshesh.rating.RatingService;
import com.avshesh.rating.RatingService.NewRating;
import com.avshesh.ratecard.RateCardService;
import com.avshesh.ratecard.RateCardService.RateCardView;
import com.avshesh.ratecard.RateCardService.RateItem;
import com.avshesh.user.AccountService;
import com.avshesh.user.CollectorBusinessProfile;
import com.avshesh.user.CollectorProfileUpdater;
import com.avshesh.user.CollectorVerifier;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;
import com.avshesh.user.VehicleType;
import com.avshesh.user.VerificationStatus;
import com.avshesh.ward.WardLocator;

/**
 * A lived-in demo city, so that every screen of every role has something real to show: officers and workers in
 * several wards, dealers and compost centers, households with finished, scheduled, ready and half-full pools,
 * payment confirmations and one open dispute, ratings, municipal requests in every status, and the activity log.
 *
 * <p>Everything goes through the same services a real user would trigger. It runs once, right after the basic demo
 * data, and is switched off for the automated tests ({@code DEMO_RICH=false}) so that they keep a small, fixed
 * starting point. All accounts log in with the password {@code demo1234}.
 */
@Component
@Profile("local")
@Order(2)
public class DemoDataExtras implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataExtras.class);
    private static final String PASSWORD = DemoDataSeeder.DEMO_PASSWORD;

    // Landmarks of real Bhubaneswar wards (each point was checked to fall inside the ward named here).
    private static final double[] WARD15 = {20.305481, 85.797729};
    private static final double[] WARD12 = {20.297, 85.8261};     // Jaydev Vihar
    private static final double[] WARD30 = {20.2887, 85.8488};   // Saheed Nagar
    private static final double[] WARD2 = {20.3604, 85.8248};    // Patia

    private final Map<Long, Long> officerWard = new java.util.HashMap<>();

    private record Gift(String phone, String item, double kg) {
    }

    private record Batch(List<Gift> gifts, Map<Long, Gift> byListing, Long poolId) {
    }

    private final boolean enabled;
    private final AccountService accounts;
    private final CollectorProfileUpdater profiles;
    private final CollectorVerifier verifier;
    private final RateCardService rateCards;
    private final ListingService listings;
    private final PickupScheduler scheduler;
    private final StopCompletionService completion;
    private final PaymentConfirmationService payments;
    private final PickupInfoProvider pickupInfo;
    private final RatingService ratings;
    private final MunicipalRequestService requests;
    private final MunicipalStaffService staff;
    private final CollectionPointService points;
    private final ActivityLog activity;
    private final WardLocator wards;

    public DemoDataExtras(@Value("${avshesh.demo.rich:true}") boolean enabled, AccountService accounts,
                          CollectorProfileUpdater profiles, CollectorVerifier verifier, RateCardService rateCards,
                          ListingService listings, PickupScheduler scheduler, StopCompletionService completion,
                          PaymentConfirmationService payments, PickupInfoProvider pickupInfo, RatingService ratings,
                          MunicipalRequestService requests, MunicipalStaffService staff, CollectionPointService points,
                          ActivityLog activity, WardLocator wards) {
        this.enabled = enabled;
        this.accounts = accounts;
        this.profiles = profiles;
        this.verifier = verifier;
        this.rateCards = rateCards;
        this.listings = listings;
        this.scheduler = scheduler;
        this.completion = completion;
        this.payments = payments;
        this.pickupInfo = pickupInfo;
        this.ratings = ratings;
        this.requests = requests;
        this.staff = staff;
        this.points = points;
        this.activity = activity;
        this.wards = wards;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Only on a database the basic seeder just filled, and only once.
        if (!enabled || accounts.findByPhone("9000000001").isEmpty() || accounts.findByPhone("9000000211").isPresent()) {
            return;
        }
        long officer15 = accounts.findByPhone("9000000201").orElseThrow().id();

        long officer12 = officer("9000000211", "Priyanka Sahoo", WARD12);
        long officer30 = officer("9000000212", "Rajesh Mishra", WARD30);
        long officer2 = officer("9000000213", "Anita Das", WARD2);
        for (Object[] w : new Object[][] {
                {officer12, "9000000311", "Tapan Barik"}, {officer12, "9000000312", "Smita Rout"},
                {officer30, "9000000313", "Dillip Jena"}, {officer30, "9000000314", "Rina Pradhan"},
                {officer2, "9000000315", "Santosh Muduli"}, {officer2, "9000000316", "Basanti Naik"}}) {
            staff.create((long) w[0], new StaffInput((String) w[2], (String) w[1], PASSWORD));
            activity.record((long) w[0], officerWard.get((long) w[0]), "STAFF_ADDED", (String) w[2]);
        }

        households();
        dealers(officer12, officer30, officer2);

        wardFifteenSecondMohalla();
        wardTwelve(officer12);
        wardThirty(officer30);
        wardTwo();
        municipalRequests(officer15, officer12, officer30, officer2);
        dropOffPoints(officer12, officer30);
        log.info("Rich demo data created: officers and workers in 4 wards, dealers, compost centers, households and pools in several states");
    }

    // ------------------------------------------------------------------ people

    private long officer(String phone, String name, double[] at) {
        long ward = wards.wardIdAt(at[0], at[1]).orElseThrow();
        UserAccount o = accounts.registerOfficer(phone, name, PASSWORD, ward);
        officerWard.put(o.id(), ward);
        activity.record(o.id(), ward, "OFFICER_CREATED", name);
        return o.id();
    }

    private void household(String phone, String name, double[] around, double dLat, double dLng) {
        UserAccount u = accounts.register(phone, name, PASSWORD, Role.HOUSEHOLD, around[0] + dLat, around[1] + dLng, "en", null);
        accounts.markPhoneVerified(u.id());
    }

    private void households() {
        double[] m2 = {WARD15[0] + 0.012, WARD15[1] + 0.006};   // a second mohalla of ward 15, about 1.4 km away
        household("9000000011", "Anjali Panda", m2, 0, 0);
        household("9000000012", "Sudhir Nayak", m2, 0.0003, 0.0002);
        household("9000000013", "Kavita Joshi", m2, -0.0003, 0.0003);
        household("9000000014", "Manoj Sahu", m2, 0.0002, -0.0003);

        household("9000000015", "Sneha Patnaik", WARD12, 0, 0);
        household("9000000016", "Rohan Mohapatra", WARD12, 0.0003, 0.0002);
        household("9000000017", "Deepa Rath", WARD12, -0.0003, 0.0003);
        household("9000000018", "Amit Biswal", WARD12, 0.0002, -0.0003);
        household("9000000019", "Lopa Mishra", WARD12, -0.0002, -0.0002);
        household("9000000020", "Gopal Swain", WARD12, 0.0006, -0.0006);

        household("9000000021", "Nandini Behera", WARD30, 0, 0);
        household("9000000022", "Pratap Jena", WARD30, 0.0003, 0.0002);
        household("9000000023", "Shweta Dash", WARD30, -0.0003, 0.0003);
        household("9000000024", "Hari Prasad", WARD30, 0.0002, -0.0003);
        household("9000000025", "Mamata Sethi", WARD30, -0.0002, -0.0002);
        household("9000000026", "Kunal Roy", WARD30, 0.0004, 0.0001);

        household("9000000027", "Tanmay Nanda", WARD2, 0, 0);
        household("9000000028", "Rekha Parida", WARD2, 0.0003, 0.0002);
    }

    private long dealer(String phone, String name, Role role, double[] at, double dLat, double dLng, String shop, String address,
                        VehicleType vehicle, double costPerKm, List<RateItem> items, double minProfit, double minLoad,
                        VerificationStatus status) {
        UserAccount u = accounts.register(phone, name, PASSWORD, role, at[0] + dLat, at[1] + dLng, "en", null);
        accounts.markPhoneVerified(u.id());
        profiles.update(u.id(), new CollectorBusinessProfile(shop, address, vehicle, costPerKm, "9 AM - 6 PM, Mon-Sat", true, null));
        rateCards.replace(u.id(), new RateCardView(5, minProfit, minLoad, null, items));
        if (status == VerificationStatus.VERIFIED) {
            verifier.setStatus(u.id(), VerificationStatus.VERIFIED);
        }
        return u.id();
    }

    private void dealers(long officer12, long officer30, long officer2) {
        List<RateItem> dry = List.of(new RateItem("PET_BOTTLE", 12, 18), new RateItem("NEWSPAPER", 14, 19),
                new RateItem("CARDBOARD", 7, 10), new RateItem("IRON_SCRAP", 30, 36), new RateItem("ALUMINIUM_CAN", 100, 115),
                new RateItem("GLASS_BOTTLE", 3, 5));
        List<RateItem> paperAndMetal = List.of(new RateItem("NEWSPAPER", 15, 21), new RateItem("CARDBOARD", 8, 12),
                new RateItem("IRON_SCRAP", 31, 38), new RateItem("ALUMINIUM_CAN", 102, 118));
        long biswajit = dealer("9000000111", "Biswajit Dash", Role.KABADIWALA, WARD12, 0.0005, 0.0005, "Biswajit Scrap Centre",
                "Jaydev Vihar Square", VehicleType.E_RICKSHAW, 8, dry, 150, 0, VerificationStatus.VERIFIED);
        long lakshmi = dealer("9000000112", "Lakshmi Prusty", Role.KABADIWALA, WARD30, 0.0005, -0.0005, "Lakshmi Recyclers",
                "Saheed Nagar Market", VehicleType.E_RICKSHAW, 9, dry, 150, 0, VerificationStatus.VERIFIED);
        dealer("9000000113", "Patia Waste Traders", Role.KABADIWALA, WARD2, 0.0005, 0.0005, "Patia Waste Traders",
                "Near Patia Square", VehicleType.CYCLE_RICKSHAW, 5, dry, 100, 0, VerificationStatus.PENDING);
        dealer("9000000114", "Orissa Metal and Paper", Role.KABADIWALA, WARD15, 0.010, 0.005, "Orissa Metal and Paper",
                "Ward 15, second market", VehicleType.MINI_TRUCK, 12, paperAndMetal, 200, 0, VerificationStatus.VERIFIED);
        long green = dealer("9000000115", "Green Odisha Compost", Role.COMPOST, WARD30, -0.0005, 0.0005, "Green Odisha Compost Yard",
                "Compost yard, Saheed Nagar", VehicleType.MINI_TRUCK, 10, List.of(new RateItem("FOOD_WASTE", 0, 4)), 100, 50,
                VerificationStatus.VERIFIED);
        dealer("9000000116", "Jaydev Compost Works", Role.COMPOST, WARD12, -0.0005, -0.0005, "Jaydev Compost Works",
                "Behind the park, Jaydev Vihar", VehicleType.E_RICKSHAW, 8, List.of(new RateItem("FOOD_WASTE", 0, 4)), 80, 40,
                VerificationStatus.PENDING);
        activity.record(officer12, wardOfPhone("9000000111"), "DEALER_VERIFIED", "Biswajit Scrap Centre");
        activity.record(officer30, wardOfPhone("9000000112"), "DEALER_VERIFIED", "Lakshmi Recyclers");
        activity.record(officer30, wardOfPhone("9000000115"), "DEALER_VERIFIED", "Green Odisha Compost Yard");
        this.biswajit = biswajit;
        this.lakshmi = lakshmi;
        this.green = green;
    }

    private long biswajit;
    private long lakshmi;
    private long green;

    private Long wardOfPhone(String phone) {
        return accounts.findByPhone(phone).orElseThrow().wardId();
    }

    // ------------------------------------------------------------------ pools in every state

    /** Households list; returns the pool they all joined and which listing belongs to which gift. */
    private Batch list(List<Gift> gifts) {
        Map<Long, Gift> byListing = new LinkedHashMap<>();
        Long poolId = null;
        for (Gift g : gifts) {
            long owner = accounts.findByPhone(g.phone()).orElseThrow().id();
            var l = listings.create(owner, new CreateRequest(g.item(), g.kg(), LocalDate.now(), ListingMode.POOL, null));
            poolId = l.poolId();
            byListing.put(l.id(), g);
        }
        return new Batch(gifts, byListing, poolId);
    }

    private PickupView accept(long dealer, Batch b, int hoursFromNow) {
        return scheduler.accept(dealer, b.poolId(), LocalDateTime.now().plusHours(hoursFromNow), LocalDateTime.now().plusHours(hoursFromNow + 2));
    }

    /**
     * The dealer collects every stop. {@code disputedPhone} (or null) says "not received" on the payment, everybody
     * else confirms.
     */
    private void complete(long dealer, Batch b, PickupView pickup, String disputedPhone) {
        b.byListing().forEach((listingId, gift) -> {
            UserAccount owner = accounts.findByPhone(gift.phone()).orElseThrow();
            Long stopId = pickup.stops().stream().filter(s -> s.ownerName().equals(owner.name()) && s.itemCode().equals(gift.item()))
                    .findFirst().orElseThrow().stopId();
            completion.complete(dealer, stopId, gift.kg(), listingId % 2 == 0 ? PaymentMode.UPI : PaymentMode.CASH);
            if (gift.phone().equals(disputedPhone)) {
                payments.respond(owner.id(), listingId, false, "He paid me less than the rate he told me");
            } else {
                payments.respond(owner.id(), listingId, true, null);
            }
        });
    }

    private void rate(Batch b, String phone, int stars, String comment) {
        b.byListing().entrySet().stream().filter(e -> e.getValue().phone().equals(phone)).findFirst().ifPresent(e ->
                ratings.create(accounts.findByPhone(phone).orElseThrow().id(), new NewRating(e.getKey(), stars, comment)));
    }

    /** A second mohalla of ward 15 with a pool that is READY: the dealer accepts it live in the demo. */
    private void wardFifteenSecondMohalla() {
        list(List.of(new Gift("9000000011", "PET_BOTTLE", 15), new Gift("9000000012", "NEWSPAPER", 25),
                new Gift("9000000013", "CARDBOARD", 20), new Gift("9000000014", "IRON_SCRAP", 6)));
    }

    private void wardTwelve(long officer12) {
        // finished and rated
        Batch done = list(List.of(new Gift("9000000015", "PET_BOTTLE", 8), new Gift("9000000016", "NEWSPAPER", 22),
                new Gift("9000000017", "CARDBOARD", 18), new Gift("9000000018", "IRON_SCRAP", 6),
                new Gift("9000000019", "ALUMINIUM_CAN", 2)));
        PickupView pickup = accept(biswajit, done, 1);
        complete(biswajit, done, pickup, null);
        rate(done, "9000000016", 5, "On time and the scale was fair.");
        rate(done, "9000000017", 4, "Good, but a little late.");
        rate(done, "9000000019", 5, "Very polite.");

        // a second round from the same mohalla, already scheduled: the households see the pickup time
        Batch scheduled = list(List.of(new Gift("9000000015", "NEWSPAPER", 30), new Gift("9000000018", "CARDBOARD", 24),
                new Gift("9000000019", "IRON_SCRAP", 8)));
        accept(biswajit, scheduled, 20);

        // half full, in another mohalla of the ward
        list(List.of(new Gift("9000000020", "NEWSPAPER", 6)));
    }

    private void wardThirty(long officer30) {
        // finished, with one household saying it was not paid correctly: the officer has a dispute to resolve
        Batch done = list(List.of(new Gift("9000000021", "NEWSPAPER", 20), new Gift("9000000022", "CARDBOARD", 25),
                new Gift("9000000023", "PET_BOTTLE", 12), new Gift("9000000024", "ALUMINIUM_CAN", 3)));
        PickupView pickup = accept(lakshmi, done, 1);
        complete(lakshmi, done, pickup, "9000000023");
        rate(done, "9000000021", 5, "Quick and honest.");
        rate(done, "9000000022", 3, "Came late in the evening.");

        // food waste collected by the compost center
        Batch wet = list(List.of(new Gift("9000000025", "FOOD_WASTE", 30), new Gift("9000000026", "FOOD_WASTE", 28),
                new Gift("9000000021", "FOOD_WASTE", 22)));
        PickupView wetPickup = accept(green, wet, 1);
        complete(green, wet, wetPickup, null);
        rate(wet, "9000000025", 5, "Nice to see the waste become compost.");

        // a new small food-waste pool
        list(List.of(new Gift("9000000026", "FOOD_WASTE", 9)));
    }

    /** Ward 2 has no verified dealer yet: its households wait, and the officer sees a dealer to approve. */
    private void wardTwo() {
        list(List.of(new Gift("9000000027", "NEWSPAPER", 14), new Gift("9000000028", "CARDBOARD", 9)));
    }

    // ------------------------------------------------------------------ the municipal corporation

    private void municipalRequests(long officer15, long officer12, long officer30, long officer2) {
        LocalDate tomorrow = LocalDate.now().plusDays(1);

        // ward 15: one scheduled for Mahesh, one done earlier, one refused
        List<StaffView> team15 = staff.list(officer15);
        long mahesh = team15.stream().filter(s -> s.name().startsWith("Mahesh")).findFirst().orElseThrow().id();
        long neha = id("9000000004");
        var scheduled = requests.create(neha, new NewRequest("THERMOCOL", 3, "Packaging from a new fridge"));
        requests.update(officer15, scheduled.id(), new StatusUpdate(RequestStatus.SCHEDULED, tomorrow, mahesh));
        activity.record(officer15, wardOfPhone("9000000004"), "REQUEST_SCHEDULED", "Thermocol / Multilayer Packaging → Mahesh Behera");
        var done = requests.create(id("9000000005"), new NewRequest("MIXED_WASTE", 6, "Renovation leftovers"));
        requests.update(officer15, done.id(), new StatusUpdate(RequestStatus.SCHEDULED, LocalDate.now(), mahesh));
        requests.update(officer15, done.id(), new StatusUpdate(RequestStatus.COLLECTED, null, null));
        activity.record(officer15, wardOfPhone("9000000005"), "REQUEST_COLLECTED", "Mixed / Soiled Waste");
        var refused = requests.create(id("9000000006"), new NewRequest("DUST_SWEEPINGS", 1, null));
        requests.update(officer15, refused.id(), new StatusUpdate(RequestStatus.REJECTED, null, null));
        activity.record(officer15, wardOfPhone("9000000006"), "REQUEST_REJECTED", "Dust / Sweepings");

        // ward 12
        long tapan = staff.list(officer12).stream().filter(s -> s.name().startsWith("Tapan")).findFirst().orElseThrow().id();
        requests.create(id("9000000016"), new NewRequest("SANITARY_WASTE", 2, null));
        var w12 = requests.create(id("9000000017"), new NewRequest("DUST_SWEEPINGS", 5, "Garden sweepings, near the gate"));
        requests.update(officer12, w12.id(), new StatusUpdate(RequestStatus.SCHEDULED, tomorrow, tapan));
        activity.record(officer12, wardOfPhone("9000000017"), "REQUEST_SCHEDULED", "Dust / Sweepings → Tapan Barik");

        // ward 30
        long dillip = staff.list(officer30).stream().filter(s -> s.name().startsWith("Dillip")).findFirst().orElseThrow().id();
        var w30 = requests.create(id("9000000024"), new NewRequest("MIXED_WASTE", 4, "Old mattress foam"));
        requests.update(officer30, w30.id(), new StatusUpdate(RequestStatus.SCHEDULED, LocalDate.now(), dillip));
        requests.update(officer30, w30.id(), new StatusUpdate(RequestStatus.COLLECTED, null, null));
        activity.record(officer30, wardOfPhone("9000000024"), "REQUEST_COLLECTED", "Mixed / Soiled Waste");
        requests.create(id("9000000022"), new NewRequest("THERMOCOL", 2, null));

        // ward 2: two waiting requests, no action yet, so the commissioner sees a ward that needs attention
        requests.create(id("9000000027"), new NewRequest("SANITARY_WASTE", 3, null));
        requests.create(id("9000000028"), new NewRequest("DUST_SWEEPINGS", 4, "Collected from the lane"));
    }

    private void dropOffPoints(long officer12, long officer30) {
        points.create(officer12, new PointInput("Jaydev Vihar Battery and E-waste Bin (demo)", "Jaydev Vihar Square",
                WARD12[0] + 0.0004, WARD12[1] + 0.0003, "Batteries, phones, chargers, wires", "Open all day", true));
        activity.record(officer12, wardOfPhone("9000000015"), "POINT_ADDED", "Jaydev Vihar Battery and E-waste Bin (demo)");
        points.create(officer30, new PointInput("Saheed Nagar Medicine Take-back (demo)", "Saheed Nagar Market",
                WARD30[0] + 0.0003, WARD30[1] - 0.0003, "Expired medicines only", "9 AM - 8 PM", true));
        activity.record(officer30, wardOfPhone("9000000021"), "POINT_ADDED", "Saheed Nagar Medicine Take-back (demo)");
    }

    private long id(String phone) {
        return accounts.findByPhone(phone).orElseThrow().id();
    }
}
