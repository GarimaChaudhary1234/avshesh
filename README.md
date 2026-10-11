# Avshesh

Turn neighbourhood waste into income. A household photographs waste, AI identifies it, and neighbours'
listings are pooled into a **Mohalla Pool**; a scrap dealer or compost center is sent only when the pooled
load is profitable. Non-recyclable waste goes to the municipal corporation, and hazardous waste to
authorised drop-off points. See [ARCHITECTURE.md](ARCHITECTURE.md) for the design.

## Run it

```
docker compose up --build -d
```

Open <http://localhost:8088>. Every account logs in with the password `demo1234`. The demo city is already lived in, so each
role has something to look at (the login page has a button for the main account of each role):

| Role | Main demo login | What it shows |
|---|---|---|
| Household | 9000000001 (Garima) | a finished food-waste collection, the share kept out of the dump, a pool to join |
| Scrap dealer | 9000000101 (Ramesh) | a READY pool in a second mohalla to accept, with the mix of items inside |
| Compost center | 9000000102 (Sunita) | wet-waste pools |
| Ward officer (ward 15) | 9000000201 | municipal requests in every status, a dealer to approve, the ward activity |
| Commissioner | 9000000200 | 67 wards, 4 with officers, one with a payment dispute, one that needs attention |
| Collection worker (ward 15) | 9000000301 (Mahesh) | a pickup to do and one done |

More accounts, all in the same demo city:

| Who | Phones |
|---|---|
| Other ward officers | 9000000211 (ward 12), 9000000212 (ward 30), 9000000213 (ward 2) |
| Collection workers | 9000000302 (ward 15), 9000000311-312 (ward 12), 9000000313-314 (ward 30), 9000000315-316 (ward 2) |
| Scrap dealers | 9000000103 (waiting for approval, ward 15), 9000000111 (ward 12), 9000000112 (ward 30), 9000000113 (waiting, ward 2), 9000000114 (ward 15, second market) |
| Compost centers | 9000000115 (ward 30), 9000000116 (waiting, ward 12) |
| Households | 9000000002-09 (ward 15), 9000000011-14 (ward 15, second mohalla), 9000000015-20 (ward 12), 9000000021-26 (ward 30), 9000000027-28 (ward 2) |

The lived-in data comes from `DemoDataExtras` and is created only on a fresh database (`DEMO_RICH=false` gives the small demo data the
automated tests start from). `node tests/api/rich-demo.mjs` checks that every role really has data to show.

Photo recognition is off by default (you name the item). To use Amazon Bedrock, copy `.env.example` to
`.env`, set `SCANNER=bedrock` and your AWS keys, then `docker compose up -d backend`.

The app is available in English, Hindi and Odia (switcher in the header). In local mode no SMS is sent: the verify-phone page shows the code on screen. New accounts can use the app at once: no SMS code is needed (`PHONE_VERIFICATION_REQUIRED=false`, the default). Back up and restore the database with `bash scripts/backup.sh` and `bash scripts/restore.sh <file>`.

Run all automated checks with `bash tests/run-all.sh` (see [tests/README.md](tests/README.md)). Set `JWT_SECRET` in `.env` so logins survive a restart.

Stop with `docker compose down` (add `-v` to also wipe the database).

## Data and licences

Ward boundaries: [Data{Meet} Municipal_Spatial_Data](https://github.com/datameet/Municipal_Spatial_Data),
Bhubaneswar Municipal Corporation wards, licensed
[CC BY-SA 2.5 India](http://creativecommons.org/licenses/by-sa/2.5/in/). The derived file
`backend/src/main/resources/data/bhubaneswar-wards.tsv` is shared under the same licence.
Shops, people, staff and drop-off points in the demo data are fictional.
