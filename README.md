# 🔄 Zoho CRM → Zoho Creator & Zoho Books Account Sync

> **Author:** Rafiullah Nikzad — Senior Zoho Developer @ CloudZ Technologies
> **GitHub:** [github.com/rafiullahnikzad](https://github.com/rafiullahnikzad)
> **Portfolio:** [rafiullahnikzad.netlify.app](https://rafiullahnikzad.netlify.app)
> **LinkedIn Community:** [Zoho Afghanistan](https://www.linkedin.com/groups/) (10,00+ Members)

---

## 📌 Overview

This Deluge automation script syncs **Account records** from **Zoho CRM** into both **Zoho Creator** and **Zoho Books** automatically whenever an Account is created or updated in CRM.

It follows a **search-first** approach — always checking if a record exists before deciding to update or create, preventing duplicate records across all three platforms.

---

## ✅ Tested & Working

```
Status:      ✅ Success
Time Taken:  2.52s

Creator  → Account found → Updated ✅  (code: 3000)
Books    → Account found → Updated ✅  (code: 0, "Contact information has been saved.")
CRM      → Books_Contact_Id saved ✅   (3341468000028756019)
```

---

## 🧩 Use Case

### Who Needs This?

- Businesses using **Zoho CRM + Zoho Creator + Zoho Books** together
- Companies that want **one entry point** — data entered in CRM flows everywhere automatically
- Teams that need customers in Books ready for invoicing as soon as a CRM Account is created
- Developers building **multi-app Zoho ecosystems** with real-time data consistency

### Real-World Scenario

```
Sales team creates or updates an Account in Zoho CRM
                    ↓
       Workflow Rule fires automatically
                    ↓
        ┌───────────────────────────┐
        │                           │
        ▼                           ▼
  Zoho Creator                Zoho Books
  (Project Management)        (Accounting)
  ─────────────────           ────────────────
  Account synced ✅           Customer synced ✅
  Billing address updated ✅  Billing address updated ✅
  Shipping address updated ✅ Shipping address updated ✅
  Ready for projects ✅       Ready for invoicing ✅
        │
        ▼
  Books_Contact_Id saved
  back to CRM Account ✅
  (Used by Contact sync later)
```

---

## 🔁 Script Logic Flow

```
START
  │
  ▼
[STEP 1] Fetch Account from CRM using account_id
  │
  ▼
[STEP 2] Build acc_map with all account fields
         (Name, Email, Phone, Billing Address, Shipping Address, Parent Account)
  │
  ▼
[STEP 3] Search Zoho Creator for existing Account
  ├── Found (code: 3000) → UPDATE Creator record ✅
  └── Not Found          → CREATE Creator record ✅
  │
  ▼
[STEP 4] Build customer_map for Zoho Books
         (contact_name, company_name, email, billing_address, shipping_address)
  │
  ▼
[STEP 5] Search Zoho Books for existing Contact by name
  ├── Found (size > 0) → PUT  (update Books contact) ✅
  └── Not Found        → POST (create Books contact) ✅
  │
  ▼
[STEP 6] Save Books_Contact_Id back to CRM Account field
         (Used later by Create_contact_in_creator for contact person sync)
  │
  ▼
END
```

---

## 📄 Full Deluge Script

```javascript
void automation.Create_account_in_Creator(Int account_id)
{
    // ============================================================
    // STEP 1: Fetch Account record from Zoho CRM
    // ============================================================
    Get_account = zoho.crm.getRecordById("Accounts", account_id);

    // ============================================================
    // STEP 2: Build Creator account map with all CRM fields
    // ============================================================
    acc_map = Map();
    acc_map.put("Zcrm_account_id", account_id);                                        // Store CRM Account ID for cross-reference
    acc_map.put("Name", ifnull(Get_account.get("Account_Name"), ""));                  // Account name
    acc_map.put("Email", ifnull(Get_account.get("Email"), ""));                        // Email address
    acc_map.put("Phone", ifnull(Get_account.get("Phone"), ""));                        // Phone number
    acc_map.put("Account_Type", ifnull(Get_account.get("Account_Type"), ""));          // Account type

    // Build billing address sub-map
    billMap = Map();
    billMap.put("address_line_1", ifnull(Get_account.get("Billing_Address"), ""));
    billMap.put("postal_Code", ifnull(Get_account.get("Billing_Zip"), ""));
    billMap.put("district_city", ifnull(Get_account.get("Billing_City"), ""));
    billMap.put("State_province", ifnull(Get_account.get("Billing_State"), ""));

    // Build shipping address sub-map
    ShipMap = Map();
    ShipMap.put("address_line_1", ifnull(Get_account.get("Shipping_Address"), ""));
    ShipMap.put("district_city", ifnull(Get_account.get("Shipping_City"), ""));
    ShipMap.put("postal_Code", ifnull(Get_account.get("Shipping_Zip"), ""));
    ShipMap.put("state_province", ifnull(Get_account.get("Shipping_State"), ""));

    acc_map.put("Billing_Address", billMap);
    acc_map.put("Shiping_Address", ShipMap);

    // Add Parent Account name only if it exists (null-safe)
    if(Get_account.get("Parent_Account") != null)
    {
        Parent_Account = Get_account.get("Parent_Account").get("name");
        acc_map.put("Parent_Account", Parent_Account.toString());
    }

    // ============================================================
    // STEP 3: Search for Account in Zoho Creator
    // Update if exists, Create if not
    // ============================================================
    filter = "Name == \"" + Get_account.get("Account_Name") + "\"";
    search_account = zoho.creator.getRecords("bairquality", "project-management", "Contacts_for_Admins", filter, 1, 200, "creator1");

    if(search_account.get("code") == 3000)
    {
        // Account found in Creator → Update existing record
        Creator_ID = search_account.get("data").get(0).get("ID");
        info "Account already exists in Zoho Creator ====> Update the Record. ID = " + Creator_ID;
        otherParams = Map();
        update_record = zoho.creator.updateRecord("bairquality", "project-management", "Contacts_for_Admins", Creator_ID.toLong(), acc_map, otherParams, "creator1");
        info "Record Updated ------>" + update_record;
    }
    else
    {
        // Account NOT found in Creator → Create new record
        info "Account NOT exists in Zoho Creator ====> Creating new record";
        option_MAP = Map();
        create_record = zoho.creator.createRecord("bairquality", "project-management", "Add_Contact", acc_map, option_MAP, "creator1");
        info "Record Created ------>" + create_record;
    }

    // ============================================================
    // STEP 4: Build Zoho Books customer map
    // Note: Nested maps must be separate Map() objects (not inline {})
    // to avoid "Invalid value passed for JSONString" error
    // ============================================================
    name = ifnull(Get_account.get("Account_Name"), "");

    billing_address = Map();
    billing_address.put("address", ifnull(Get_account.get("Billing_Address"), ""));
    billing_address.put("zip", ifnull(Get_account.get("Billing_Zip"), ""));
    billing_address.put("city", ifnull(Get_account.get("Billing_City"), ""));
    billing_address.put("state", ifnull(Get_account.get("Billing_State"), ""));

    shipping_address = Map();
    shipping_address.put("address", ifnull(Get_account.get("Shipping_Address"), ""));
    shipping_address.put("zip", ifnull(Get_account.get("Shipping_Zip"), ""));
    shipping_address.put("city", ifnull(Get_account.get("Shipping_City"), ""));
    shipping_address.put("state", ifnull(Get_account.get("Shipping_State"), ""));

    customer_map = Map();
    customer_map.put("contact_name", name);
    customer_map.put("company_name", name);
    customer_map.put("email", ifnull(Get_account.get("Email"), ""));
    customer_map.put("billing_address", billing_address);
    customer_map.put("shipping_address", shipping_address);

    // ============================================================
    // STEP 5: Search for Account in Zoho Books by contact_name
    // Update if exists, Create if not
    // books_contact_id captured in BOTH paths to save back to CRM
    // ============================================================
    search_contact = invokeurl
    [
        url: "https://www.zohoapis.com/books/v3/contacts?contact_name=" + name + "&organization_id=YOUR_ORG_ID"
        type: GET
        connection: "books1"
    ];
    info "search_contact in Books: " + search_contact;

    books_contact_id = ""; // Initialize to avoid null errors later

    if(search_contact.get("contacts").size() > 0)
    {
        // Contact found in Books → Update existing contact
        books_contact_id = search_contact.get("contacts").get(0).get("contact_id");
        info "Account exists in Books → Updating contact_id: " + books_contact_id;
        update_customer = invokeurl
        [
            url: "https://www.zohoapis.com/books/v3/contacts/" + books_contact_id + "?organization_id=YOUR_ORG_ID"
            type: PUT
            parameters: customer_map.toString()    // .toString() required to avoid 400 error
            connection: "books1"
        ];
        info "update customer in Books: " + update_customer;
    }
    else
    {
        // Contact NOT found in Books → Create new contact
        info "Account NOT exists in Books → Creating new contact";
        create_customer = invokeurl
        [
            url: "https://www.zohoapis.com/books/v3/contacts?organization_id=YOUR_ORG_ID"
            type: POST
            parameters: customer_map.toString()    // .toString() required to avoid 400 error
            connection: "books1"
        ];
        info "create customer in Books: " + create_customer;

        // Extract new contact_id from the Books create response
        books_contact_id = create_customer.get("contact").get("contact_id");
    }

    // ============================================================
    // STEP 6: Save Books_Contact_Id back to CRM Account field
    // Critical: This field is read by Create_contact_in_creator
    // to link contact persons in Books to the correct parent contact
    // ============================================================
    if(books_contact_id != "" && books_contact_id != null)
    {
        update_crm = Map();
        update_crm.put("Books_Contact_Id", books_contact_id);
        zoho.crm.updateRecord("Accounts", account_id, update_crm);
        info "Books_Contact_Id saved to CRM Account: " + books_contact_id;
    }
    else
    {
        info "Books_Contact_Id is empty → Skipping CRM update";
    }
}
```

---

## ⚙️ Setup & Configuration

### Step 1 — Prerequisites

| Requirement | Details |
|-------------|---------|
| Zoho CRM | Any paid plan with workflow automation |
| Zoho Creator | App with `Contacts_for_Admins` report and `Add_Contact` form |
| Zoho Books | Active organization with Contacts module |
| Custom CRM Field | `Books_Contact_Id` (Text) on the Accounts module |

### Step 2 — Add Custom Field in CRM

1. Go to **CRM → Setup → Modules → Accounts → Fields**
2. Click **New Field**
3. Configure:

| Setting | Value |
|---------|-------|
| Field Label | `Books Contact Id` |
| API Name | `Books_Contact_Id` |
| Field Type | Single Line |

### Step 3 — Create Connections

#### Creator Connection (`creator1`)
1. Go to **CRM → Setup → Developer Space → Connections**
2. Click **New Connection → Zoho OAuth → Zoho Creator**
3. Required scopes:
```
ZohoCreator.report.READ
ZohoCreator.report.UPDATE
ZohoCreator.form.CREATE
```
4. Name it: `creator1`

#### Books Connection (`books1`)
1. Go to **CRM → Setup → Developer Space → Connections**
2. Click **New Connection → Zoho OAuth → Zoho Books**
3. Required scopes:
```
ZohoBooks.contacts.READ
ZohoBooks.contacts.CREATE
ZohoBooks.contacts.UPDATE
```
4. Name it: `books1`

### Step 4 — Update Script Placeholders

| Placeholder | Replace With | Where to Find |
|-------------|-------------|---------------|
| `"bairquality"` | Your Creator owner username | Creator URL |
| `"project-management"` | Your Creator app link name | Creator URL |
| `"Contacts_for_Admins"` | Your Creator report name | Creator app |
| `"Add_Contact"` | Your Creator form name | Creator app |
| `YOUR_ORG_ID` | Your Books Organization ID | Books → Settings → Organization Profile |

### Step 5 — Create CRM Workflow Rule

1. Go to **CRM → Setup → Automation → Workflow Rules → New Rule**
2. Configure:

| Setting | Value |
|---------|-------|
| Module | Accounts |
| Rule Name | `Create_account_in_Creator` |
| When to trigger | A record is **Created** or **Edited** |
| Run | Every time a record is modified |
| Condition | All Accounts (or add specific criteria) |
| Action | **Function** → `Create_account_in_Creator` |

---

## 🔑 Deluge Functions & APIs Used

### Deluge Built-in Functions

| Function | Purpose | Official Docs |
|----------|---------|---------------|
| `zoho.crm.getRecordById()` | Fetch CRM Account by ID | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/crm/get-record.html) |
| `zoho.crm.updateRecord()` | Update CRM Account field | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/crm/update-record.html) |
| `zoho.creator.getRecords()` | Search Creator records with filter | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/get-records.html) |
| `zoho.creator.updateRecord()` | Update existing Creator record | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/update-record.html) |
| `zoho.creator.createRecord()` | Create new Creator record | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/add-record.html) |
| `invokeurl` | Make REST API calls to Zoho Books | [📖 Docs](https://www.zoho.com/deluge/help/webhook/invokeurl-api-task.html) |
| `ifnull()` | Return default if value is null | [📖 Docs](https://www.zoho.com/deluge/help/built-in-functions/ifnull.html) |
| `Map()` | Create key-value data structure | [📖 Docs](https://www.zoho.com/deluge/help/datatypes/map.html) |
| `.toString()` | Convert Map to JSON string for API | [📖 Docs](https://www.zoho.com/deluge/help/datatypes/map.html) |

### Zoho Books REST API Endpoints

| Operation | Method | Endpoint | Docs |
|-----------|--------|----------|------|
| Search Contact | GET | `/books/v3/contacts?contact_name={name}&organization_id={id}` | [📖 Docs](https://www.zoho.com/books/api/v3/contacts/#list-contacts) |
| Create Contact | POST | `/books/v3/contacts?organization_id={id}` | [📖 Docs](https://www.zoho.com/books/api/v3/contacts/#create-a-contact) |
| Update Contact | PUT | `/books/v3/contacts/{contact_id}?organization_id={id}` | [📖 Docs](https://www.zoho.com/books/api/v3/contacts/#update-a-contact) |

### Books API Request Body

```json
{
  "contact_name": "Test Account",
  "company_name": "Test Account",
  "email": "test@example.com",
  "billing_address": {
    "address": "123 Main Street",
    "city": "Dallas",
    "state": "Texas",
    "zip": "75001"
  },
  "shipping_address": {
    "address": "123 Main Street",
    "city": "Dallas",
    "state": "Texas",
    "zip": "75001"
  }
}
```

### Zoho Creator API Reference

| Operation | Deluge Task | Filter Syntax | Docs |
|-----------|-------------|---------------|------|
| Search records | `zoho.creator.getRecords()` | `"Name == \"value\""` | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/get-records.html) |
| Update record | `zoho.creator.updateRecord()` | Record ID required | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/update-record.html) |
| Create record | `zoho.creator.createRecord()` | — | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/add-record.html) |

---

## ⚠️ Common Errors & Solutions

| Error | Root Cause | Solution |
|-------|-----------|----------|
| `400 Invalid value passed for JSONString` | Passing Map object directly to Books API | Add `.toString()` to `parameters` |
| `Value is empty and 'get' cannot be applied` | Using `create_customer` variable outside its scope | Initialize `books_contact_id = ""` before if/else; extract inside each block |
| `NullPointerException` on Parent_Account | Parent Account is null | Wrapped in `if != null` check ✅ |
| Creator returns `code: 3100` | Record not found | Expected — triggers create flow ✅ |
| Books returns `contacts: []` | Account not found by name | Expected — triggers create flow ✅ |
| Books `Books_Contact_Id` empty in Contact sync | Account sync not run first | Run Account sync before Contact sync |

---

## 🔗 Related Scripts in This Collection

This script is **Part 1** of a 3-script CRM sync system:

| Script | Purpose | Status |
|--------|---------|--------|
| `Create_account_in_Creator` | Sync CRM Account → Creator + Books | ✅ This script |
| `Create_contact_in_creator` | Sync CRM Contact → Creator + Books Contact Person | ✅ Available |
| `update_Portal_active_creator` | Sync Portal Active flag → Creator + invite/remove portal user | ✅ Available |

---

## 💡 Important Notes

**Why `.toString()` is required for Books API:**
Zoho Books REST API expects JSON string format. Passing a `Map()` object directly causes a `400` error. Always call `.toString()` on the map before passing to `parameters`.

**Why `books_contact_id` must be initialized before the if/else:**
If you try to read `create_customer.get("contact")` outside the else block, it throws `"Value is empty and 'get' cannot be applied"` because `create_customer` only exists inside the else scope. The fix is to initialize `books_contact_id = ""` before and set it inside each branch.

**Why Books_Contact_Id is saved back to CRM:**
The companion script `Create_contact_in_creator` needs this ID to add contact persons under the correct Books contact. Without it, the contact person sync is skipped automatically with a warning.

---

## 📚 Additional Resources

| Resource | Link |
|----------|------|
| Zoho Deluge Help Center | [zoho.com/deluge/help](https://www.zoho.com/deluge/help/) |
| Zoho Books API v3 | [zoho.com/books/api/v3](https://www.zoho.com/books/api/v3/) |
| Zoho Creator API v2 | [zoho.com/creator/help/api/v2](https://www.zoho.com/creator/help/api/v2/) |
| Zoho CRM Functions | [zoho.com/crm/developer/docs/functions](https://www.zoho.com/crm/developer/docs/functions/) |
| InvokeURL Task Docs | [zoho.com/deluge/help/webhook/invokeurl](https://www.zoho.com/deluge/help/webhook/invokeurl-api-task.html) |
| Deluge Data Types | [zoho.com/deluge/help/datatypes](https://www.zoho.com/deluge/help/datatypes.html) |
| Learn Deluge Interactive | [deluge.zoho.com/learndeluge](https://deluge.zoho.com/learndeluge) |
| Zoho CRM Workflow Rules | [zoho.com/crm/help/workflow-rules](https://www.zoho.com/crm/help/automation/workflow-rules.html) |

---

## 📬 Contact & Community

- **LinkedIn:** [Rafiullah Nikzad](https://www.linkedin.com/in/rafiullahnikzad)
- **Community:** [Zoho Afghanistan — 10,000+ Members](https://www.linkedin.com/groups/)
- **Portfolio:** [rafiullahnikzad.netlify.app](https://rafiullahnikzad.netlify.app)
- **GitHub:** [55+ Free Deluge Scripts](https://github.com/rafiullahnikzad)

---

*Part of the free Zoho Deluge automation scripts collection — helping businesses automate smarter across the Zoho ecosystem.*
