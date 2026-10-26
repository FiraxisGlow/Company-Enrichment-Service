# PRH Company Data Enrichment Service

## How to run

Make sure you have Docker installed on your machine and in the terminal run: `docker compose up --build` (`docker-compose up --build` on older installations).

Open the client on [localhost:3000](http://localhost:3000/).
There will be a field to drop your CSV file into and the service will take care of the rest.
The result is shown in three tabs: the matched companies, the company records they map to, and the rows that need attention.

### Without Docker

With Node.js 22 installed, start the server and the client in two terminals:

```sh
cd server && npm install && npm run dev   # API on localhost:5000
cd client && npm install && npm run dev   # UI on localhost:5173, /api is proxied to the server
```

Open the client on [localhost:5173](http://localhost:5173/).

Expect roughly one second per CSV row, since requests to PRH are spaced out to stay under its rate limit. The 50 row sample takes about a minute.

## Sample file

samples/test-companies.csv is an example list of 50 rows: 13 companies by name only, 14 by business ID only, 13 with both, and 10 invented names that cannot match, so the error handling is exercised.
The company names and IDs are real public registry entries, collected from an independent source (Asiakastieto's company search), so the file also checks that the PRH data agrees with it. Rows with both an ID and a name are cross-checked, so a name that differs from the registered name shows up in errors (`name_mismatch`), as designed: `Oy Hartwall Ab (Bryggeri Helsinki)` is one. Name-only rows that carry a display alias, such as `Rinta-Joupin Autoliike Oy (Rinta-Jouppi Helsinki)`, are not registered names and are reported as `not_found`.

Running the sample gives 37 matches and 13 errors: 12 `not_found` (the 10 invented names and the 2 name-only aliases) and 1 `name_mismatch`.
The file was made by me and was only used to validate development progress.

## Assignment breakdown

### Assumptions

- Containerization of the project is necessary for ease of deployment
- The PRH API is a public API and thus will have some sort of rate limiting so the program needs to be slow enough to not trigger that.
- File upload through UI so it's convenient to use.
- Name-only rows are only as reliable as the name is unique. A business ID in the CSV is always the safer input. This means only exact name matches should count.
- When a row has both a business ID and a name, the ID is used for the lookup but the name must agree with the register. Otherwise the ID may be a typo for a different company.
- No NetSuite account was available, so the company record uses NetSuite-style field names. The `custentity_*` names are placeholders for custom fields.

### API

`POST /api/companies/match` takes the CSV as a multipart form field named `file`.

The CSV needs a business ID column (`business_id` or `y-tunnus`), a company name column (`name`, `company_name`, `company`, `nimi`, `yritys` or `toiminimi`), or both. Headers are matched ignoring case, spaces, underscores and hyphens, so `Business ID` and `ytunnus` also work. It must be UTF-8, and comma, semicolon or tab separated.

```jsonc
{
  "total": 50,
  "matchedCount": 37,
  "errorCount": 13,
  "matches": [/* normalized companies, in CSV order */],
  "companies": [/* one company record per match, same order */],
  "errors": [/* rows that were not matched */],
}
```

A bad file (wrong columns, not UTF-8, too many rows) returns HTTP 400. A file where some rows fail still returns HTTP 200, since a partly matched list is a usable result.

Every error has the file row, the input, a code and a message, and sometimes `candidates`:

| code                  | meaning                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `invalid_business_id` | malformed ID or wrong check digit                                               |
| `not_found`           | no company has that ID or name                                                  |
| `name_mismatch`       | the ID exists but the name in the same row matches none of that company's names |
| `no_exact_match`      | no exact name match, but similar names exist (listed as `candidates`)           |
| `ambiguous_name`      | several companies have exactly this name (listed as `candidates`)               |
| `no_identifier`       | the row has neither an ID nor a name                                            |
| `lookup_failed`       | the PRH API call failed after retries, or the upload ran out of time            |

Limits: 5 MB, a row cap (`MAX_ROWS` in `server/src/matchCompanies.ts`), and requests to PRH are paced about a second apart. An upload is stopped after 4 minutes, which is under the proxy timeout. Rows that were not reached are reported as `lookup_failed` and everything matched until then is still returned. If the client disconnects the server stops calling PRH.

### Field mapping and reasoning

This is the normalized result in `matches`. The name and business ID always come from the register. The values in the CSV are only used to find the company.

| Field            | Sub-Fields       | [PRH field](https://avoindata.prh.fi/fi/ytj/swagger-ui)                                  | Reason for field                                                                                                                                                                      |
| ---------------- | ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name             | -                | RegisterName.name when RegisterName.type = 1 and it has no end date                      | Mandatory field for users to know what business is in question. The current official name from PRH.                                                                                   |
| businessId       | -                | Company.businessId.value                                                                 | Mandatory field for invoicing. From PRH, so the format is always the same.                                                                                                            |
| addresses        |                  | Company.addresses                                                                        | An array containing all the company addresses.                                                                                                                                        |
|                  | address          | Address.street + Address.buildingNumber (Address.freeAddressLine for foreign addresses)  | Combination of PRH street and buildingNumber for a more standardized address format.                                                                                                  |
|                  | postcode         | Address.postCode                                                                         | Mandatory data for any address.                                                                                                                                                       |
|                  | city             | PostOffice.city                                                                          | PRH postOffices city value in Finnish, mandatory for any address.                                                                                                                     |
|                  | entrance         | Address.entrance                                                                         | Kept separate from the street so it can be shown or left out as needed.                                                                                                               |
|                  | apartment        | Address.apartmentNumber + Address.apartmentIdSuffix                                      | Needed for deliveries to apartment buildings.                                                                                                                                         |
|                  | postOfficeBox    | Address.postOfficeBox                                                                    | Shown as `PL 10`. Invoices are routinely sent to a PO box, so it must not be dropped.                                                                                                 |
|                  | co               | Address.co                                                                               | The c/o line, needed for the address to reach the right recipient.                                                                                                                    |
|                  | country          | Address.country                                                                          | Two-letter code. Null when PRH does not state one.                                                                                                                                    |
|                  | isMailingAddress | Address.type                                                                             | Boolean based on PRH Address.type where 2 is the mailing address. Boolean because it's easier to handle to indicate a mailing address for priority for invoicing.                     |
| website          | -                | Company.website.url                                                                      | Company website, optional but could be relevant in niche cases for sales purposes.                                                                                                    |
| companyForm      |                  | Company.companyForms (the current one)                                                   | An object with the current [company form](https://avoindata.prh.fi/opendata-ytj-api/v3/description?code=YRMU&lang=fi). Not an array and not passed straight through.                  |
|                  | shorthand        | Looked up by CompanyForm.type from the YRMU code list, kept as a constant                | Standardized abbreviation of company form for quick lookup.                                                                                                                           |
|                  | description      | Looked up by CompanyForm.type from the YRMU code list, kept as a constant                | Full name of the company form (in Finnish) for explaining less common shorthands.                                                                                                     |
| mainBusinessLine |                  | Company.mainBusinessLine                                                                 | Additional information on what the business does. Should help sales staff with their work.                                                                                            |
|                  | type             | Company.mainBusinessLine.type                                                            | TOL code.                                                                                                                                                                             |
|                  | description      | DescriptionEntry.description                                                             | Description of the line of business (in Finnish).                                                                                                                                     |
| lastModified     | -                | Company.lastModified                                                                     | Added to check if the company has updated since it was last run through this program to prevent unnecessary updates. Useful for further development in customer registry integration. |
| active           | -                | Derived from Company.endDate and Company.companySituations                               | False when the company has ceased or has an open liquidation or bankruptcy. A company in bankruptcy must not be imported as an active customer.                                       |
| situations       | -                | Company.companySituations without an end date                                            | Open restructuring (`SANE`), liquidation (`SELTILA`) or bankruptcy (`KONK`). A company in restructuring still trades, so it stays active but is flagged for credit control.           |
| vatNumber        | -                | Derived: `FI` + business ID digits, when Company.registeredEntries has an open VAT entry | Needed for invoicing. Only set when the register shows an open VAT registration (register 6), so a company without one never gets a made-up number.                                   |

### Company record mapping and reasoning

Field names are modeled on NetSuite's customer record. The mapping is in `server/src/companyMapping.ts`, returned in the `companies` array and shown in the "Company records" tab.

| Company record field                                   | Taken from         | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `businessId`                                           | `businessId`       | The natural unique key of a company. An importer maps it to NetSuite's `externalId`, so re-importing a list updates existing records instead of creating duplicates.                                                                                                                                                                                                                                                                                                                                                               |
| `isPerson`                                             | always `false`     | Every record is an organization.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `companyName`                                          | `name`             | The current official name. Former and auxiliary names are only used for matching.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `isInactive`                                           | `!active`          | A ceased company, or one in liquidation or bankruptcy, is flagged inactive but not dropped, so history and open invoices stay intact and nobody keeps selling to it by accident. A company in restructuring stays active but is flagged in `custentity_company_situation`.                                                                                                                                                                                                                                                         |
| `vatRegNumber`                                         | `vatNumber`        | Needed for invoicing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `url`                                                  | `website`          | `https://` is added, since PRH stores addresses like `www.example.fi`.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `addressBook`                                          | `addresses`        | The mailing address becomes the default billing address and the street address the default shipping address, since invoices are posted and deliveries are visited. A PO box works for billing but not for deliveries, so a company with only a PO box gets a billing entry only. If both are the same place they become one entry with both roles. `addr1` is the street line (street, number, entrance, apartment) or the PO box, `addr2` carries the c/o line, and the country is PRH's country code (`FI` when none is stated). |
| `custentity_legal_form`, `custentity_legal_form_desc`  | `companyForm`      | Legal form drives credit and tax decisions (a sole trader is not an Oy), so it is a filterable field instead of being buried in the name.                                                                                                                                                                                                                                                                                                                                                                                          |
| `custentity_industry_code`, `custentity_industry_desc` | `mainBusinessLine` | Lets sales segment companies by industry. The code is stored next to its description so the description can change without losing the key.                                                                                                                                                                                                                                                                                                                                                                                         |
| `custentity_company_situation`                         | `situations`       | Open restructuring, liquidation or bankruptcy codes, comma separated.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `custentity_registry_updated`                          | `lastModified`     | A timestamp of the source data, so a later sync can skip records that have not changed.                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Example (Dynava Oy, trimmed):

```json
{
  "businessId": "0100130-4",
  "isPerson": false,
  "companyName": "Dynava Oy",
  "isInactive": false,
  "vatRegNumber": "FI01001304",
  "url": "https://www.dynava.fi",
  "addressBook": [
    {
      "defaultBilling": true,
      "defaultShipping": true,
      "addressBookAddress": {
        "addressee": "Dynava Oy",
        "addr1": "Valimotie 17-19",
        "addr2": null,
        "city": "Helsinki",
        "zip": "00380",
        "country": "FI"
      }
    }
  ],
  "custentity_legal_form": "OY",
  "custentity_legal_form_desc": "Osakeyhtiö",
  "custentity_industry_code": "82200",
  "custentity_industry_desc": "Puhelinpalvelukeskusten toiminta",
  "custentity_company_situation": null,
  "custentity_registry_updated": "2026-10-22T01:19:06"
}
```

Left out on purpose: phone and email (PRH does not provide them), the EUID (a European identifier, not a VAT number) and `subsidiary`.
NetSuite OneWorld requires a subsidiary on every customer, but which legal entity of the dealership sells to a company is not in the register, so it has to be set by the importing account.

### Decisions

- Using TypeScript for type safety since it compiles into JavaScript and you avoid the usual JavaScript pitfalls.
- Omitting a database as there's no need for storing the data in the service itself and the need for one would only arise with user management in further development.
- Using Vite to create the React project for the frontend since it was recommended in [Docker documentation](https://www.docker.com/blog/how-to-dockerize-react-app/) for containerizing.
- Implementing [Atomic Design principles](https://atomicdesign.bradfrost.com/chapter-2/) for the frontend as it makes maintenance and future development easier.
- Set up Prettier and ESLint for better readability.
- Only exact name matches are accepted. Similar names are returned in `errors` as candidates, never merged into the results.
- A name counts as an exact match if it equals any of the company's current, former, parallel or auxiliary names (ignoring case and extra spaces). The company is always returned under its current official name, so a match on an old name looks different from the CSV value.
- Requests to PRH are paced and share one back-off, and an upload is cut off after 4 minutes with partial results. This keeps the service under PRH's rate limit and under the proxy timeout.
- The company form list (YRMU) is kept as a constant instead of being fetched, since it rarely changes and fetching it would add a request to a rate limited API on every upload.
- `matches` holds the normalized registry data and `companies` the import-ready records, so each step of the mapping can be checked on its own.

### Next steps

Next would be user management so that the tool is only available to those who manage the customer registry.
This would involve tacking on a database and OAuth 2.0 compliant logins.
Any sort of user management also involves the need for password management and the ability to reset passwords

After that would come actual NetSuite integration.

Large files are slow by design because of the rate limit. A background job with progress reporting would let the user follow a long upload instead of waiting for the response.

PRH's `status` and `tradeRegisterStatus` codes are not interpreted yet. Cessation and company situations are used instead.

Later development could also include fuzzy/partial name matching and allowing the user to pick the correct dataset for import.

Adding unit tests for the frontend components and end to end tests to make sure the API works could be useful.

### AI use

#### Model used

Sonnet 5.5 with the free tier of Claude

#### Usage

Claude was used extensively throughout the assignment.
First I setup the development environment in WSL and containerizing the project with Docker.
After that I worked out the necessary fields for data enrichment.

It was at this point that I started implementing the backend with Claude that I had the requirements from the assignment, my own requirements from my assumptions, and the data structure I was after.
Once Claude was done with the backend I went through it removing linter errors.
At this point I had to test the API with a test CSV file and Insomnia to validate the output.
To my surprise it did produce a functioning backend that's still very much legible and understandable by humans.

With the output validated I prompted Claude to create a frontend in accordance to the Atomic Design principles with a list of components that I needed for the type of view I wanted.
I'm not a UI/UX designer so I figured Claude would come up with a good enough solution.
Once again I had to go through a bunch of linter errors and fix those however it did produce coherent components in accordance to the specified design principles.
