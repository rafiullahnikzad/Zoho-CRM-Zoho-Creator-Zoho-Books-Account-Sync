# 🔄 Zoho CRM → Zoho Creator & Zoho Books Account Sync

> **Author:** Rafiullah Nikzad — Senior Zoho Developer @ CloudZ Technologies  
> **GitHub:** [github.com/rafiullahnikzad](https://github.com/rafiullahnikzad)  
> **LinkedIn Community:** [Zoho Afghanistan](https://www.linkedin.com/groups/) (10,000+ Members)  
> **Portfolio:** [rafiullahnikzad.netlify.app](https://rafiullahnikzad.netlify.app)

---

## 📌 Overview

This Deluge script automatically syncs **Account records** from **Zoho CRM** into both **Zoho Creator** and **Zoho Books** whenever an account is created or updated in CRM.

### What It Does

| Step | Action |
|------|--------|
| 1 | Fetches Account data from Zoho CRM by `account_id` |
| 2 | Searches for the Account in Zoho Creator |
| 3 | Updates the Creator record if found, creates a new one if not |
| 4 | Searches for the Account in Zoho Books as a Contact |
| 5 | Updates the Books contact if found, creates a new one if not |

---

## 🧩 Use Case in Zoho CRM

### When to Use This Script

- You have a **Zoho Creator app** that manages projects, locations, or jobs linked to CRM Accounts
- You use **Zoho Books** for invoicing and need customers synced automatically
- You want a **single source of truth** — data entered once in CRM flows everywhere
- You manage **multi-location businesses** where each CRM account needs a corresponding Creator record

### Real-World Example

```
Sales team creates/updates an Account in Zoho CRM
            ↓
Workflow Rule fires automatically
            ↓
    ┌───────────────────────────────┐
    │                               │
    ▼                               ▼
Zoho Creator                  Zoho Books
(Project Management App)      (Accounting)
- Account synced              - Customer contact synced
- Billing address updated     - Billing/shipping address updated
- Ready for project creation  - Ready for invoicing
```

### Trigger: Zoho CRM Workflow Rule

Set up a **Workflow Rule** in CRM on the **Accounts** module:

| Setting | Value |
|---------|-------|
| Module | Accounts |
| Trigger | On Create, On Edit |
| Condition | All Accounts (or specific criteria) |
| Action | Call Function → `Create_account_in_Creator` |

---

## 📄 Full Deluge Script

```javascript
void automation.Create_account_in_Creator(Int account_id)
{
    Get_account = zoho.crm.getRecordById("Accounts", account_id);

    /* ============================================
       PART 1: Sync Account into Zoho Creator
       ============================================ */
    acc_map = Map();
    acc_map.put("Zcrm_account_id", account_id);
    acc_map.put("Name", ifnull(Get_account.get("Account_Name"), ""));
    acc_map.put("Email", ifnull(Get_account.get("Email"), ""));
    acc_map.put("Phone", ifnull(Get_account.get("Phone"), ""));
    acc_map.put("Account_Type", ifnull(Get_account.get("Account_Type"), ""));

    billMap = Map();
    billMap.put("address_line_1", ifnull(Get_account.get("Billing_Address"), ""));
    billMap.put("postal_Code", ifnull(Get_account.get("Billing_Zip"), ""));
    billMap.put("district_city", ifnull(Get_account.get("Billing_City"), ""));
    billMap.put("State_province", ifnull(Get_account.get("Billing_State"), ""));

    ShipMap = Map();
    ShipMap.put("address_line_1", ifnull(Get_account.get("Shipping_Address"), ""));
    ShipMap.put("district_city", ifnull(Get_account.get("Shipping_City"), ""));
    ShipMap.put("postal_Code", ifnull(Get_account.get("Shipping_Zip"), ""));
    ShipMap.put("state_province", ifnull(Get_account.get("Shipping_State"), ""));

    acc_map.put("Billing_Address", billMap);
    acc_map.put("Shiping_Address", ShipMap);

    if(Get_account.get("Parent_Account") != null)
    {
        Parent_Account = Get_account.get("Parent_Account").get("name");
        acc_map.put("Parent_Account", Parent_Account.toString());
    }

    // Search for existing account in Creator
    filter = "Name == \"" + Get_account.get("Account_Name") + "\"";
    search_account = zoho.creator.getRecords("bairquality", "project-management", "Contacts_for_Admins", filter, 1, 200, "creator1");

    if(search_account.get("code") == 3000)
    {
        // Account exists → Update
        Creator_ID = search_account.get("data").get(0).get("ID");
        info "Account already exists in Zoho Creator ====> Update the Record. ID = " + Creator_ID;
        otherParams = Map();
        update_record = zoho.creator.updateRecord("bairquality", "project-management", "Contacts_for_Admins", Creator_ID.toLong(), acc_map, otherParams, "creator1");
        info "Record Updated ------ >" + update_record;
    }
    else
    {
        // Account does NOT exist → Create
        info search_account.get("code") + "-----" + filter;
        info "Account NOT exists in Zoho Creator ====> Create the Record in Add Account Form";
        option_MAP = Map();
        create_record = zoho.creator.createRecord("bairquality", "project-management", "Add_Contact", acc_map, option_MAP, "creator1");
        info "Record Created ------ >" + create_record;
    }

    /* ============================================
       PART 2: Sync Account into Zoho Books
       ============================================ */
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

    // Search for existing contact in Zoho Books by name
    search_contact = invokeurl
    [
        url: "https://www.zohoapis.com/books/v3/contacts?contact_name=" + name + "&organization_id=YOUR_ORG_ID"
        type: GET
        connection: "books1"
    ];
    info "search_contact in Books: " + search_contact;

    if(search_contact.get("contacts").size() > 0)
    {
        // Contact exists → Update
        contactid = search_contact.get("contacts").get(0).get("contact_id");
        info "Account exists in Books → Updating contact_id: " + contactid;
        update_customer = invokeurl
        [
            url: "https://www.zohoapis.com/books/v3/contacts/" + contactid + "?organization_id=YOUR_ORG_ID"
            type: PUT
            parameters: customer_map.toString()
            connection: "books1"
        ];
        info "update customer in books : " + update_customer;
    }
    else
    {
        // Contact does NOT exist → Create
        info "Account NOT exists in Books → Creating new contact";
        create_customer = invokeurl
        [
            url: "https://www.zohoapis.com/books/v3/contacts?organization_id=YOUR_ORG_ID"
            type: POST
            parameters: customer_map.toString()
            connection: "books1"
        ];
        info "create customer in Books : " + create_customer;
    }
}
```

---

## ⚙️ Setup & Configuration

### Step 1 — Prerequisites

- Zoho CRM (any paid plan)
- Zoho Creator app with:
  - A report named `Contacts_for_Admins`
  - A form named `Add_Contact`
- Zoho Books with an active organization

### Step 2 — Create Connections

#### Creator Connection (`creator1`)
1. Go to **CRM → Setup → Developer Space → Connections**
2. Click **New Connection**
3. Select **Zoho OAuth** → choose **Zoho Creator**
4. Scopes needed:
   ```
   ZohoCreator.report.READ
   ZohoCreator.report.UPDATE
   ZohoCreator.form.CREATE
   ```
5. Name it `creator1`

#### Books Connection (`books1`)
1. Go to **CRM → Setup → Developer Space → Connections**
2. Click **New Connection**
3. Select **Zoho OAuth** → choose **Zoho Books**
4. Scopes needed:
   ```
   ZohoBooks.contacts.READ
   ZohoBooks.contacts.CREATE
   ZohoBooks.contacts.UPDATE
   ```
5. Name it `books1`

### Step 3 — Update Script Variables

Replace these placeholders in the script:

| Placeholder | Replace With |
|-------------|-------------|
| `"bairquality"` | Your Zoho Creator owner username |
| `"project-management"` | Your Zoho Creator app link name |
| `"Contacts_for_Admins"` | Your Creator report name |
| `"Add_Contact"` | Your Creator form name |
| `YOUR_ORG_ID` | Your Zoho Books Organization ID |

> **Find your Books Org ID:** Zoho Books → Settings → Organization Profile → Organization ID

### Step 4 — Create CRM Workflow Rule

1. Go to **CRM → Setup → Automation → Workflow Rules**
2. Click **Create Rule**
3. Configure:

```
Module:    Accounts
Rule Name: Create_account_in_Creator
Trigger:   A record is Created or Edited
Condition: All Accounts
Action:    Function → Create_account_in_Creator
```

---

## 🔑 Key Deluge Functions Used

| Function | Purpose | Docs |
|----------|---------|------|
| `zoho.crm.getRecordById()` | Fetch CRM Account by ID | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/crm/get-record.html) |
| `zoho.creator.getRecords()` | Search Creator records with filter | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/get-records.html) |
| `zoho.creator.updateRecord()` | Update existing Creator record | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/update-record.html) |
| `zoho.creator.createRecord()` | Create new Creator record | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/add-record.html) |
| `invokeurl` | Call Zoho Books REST API | [📖 Docs](https://www.zoho.com/deluge/help/webhook/invokeurl-api-task.html) |
| `ifnull()` | Handle null values safely | [📖 Docs](https://www.zoho.com/deluge/help/built-in-functions/ifnull.html) |
| `Map()` | Create key-value data structure | [📖 Docs](https://www.zoho.com/deluge/help/datatypes/map.html) |

---

## 🌐 Zoho Books API References

| API Call | Method | Endpoint | Docs |
|----------|--------|----------|------|
| Search Contact by Name | GET | `/books/v3/contacts?contact_name={name}` | [📖 Docs](https://www.zoho.com/books/api/v3/contacts/#list-contacts) |
| Create Contact | POST | `/books/v3/contacts` | [📖 Docs](https://www.zoho.com/books/api/v3/contacts/#create-a-contact) |
| Update Contact | PUT | `/books/v3/contacts/{contact_id}` | [📖 Docs](https://www.zoho.com/books/api/v3/contacts/#update-a-contact) |

### Books API Request Body Structure

```json
{
  "contact_name": "Account Name",
  "company_name": "Account Name",
  "email": "email@example.com",
  "billing_address": {
    "address": "123 Main St",
    "city": "Dallas",
    "state": "Texas",
    "zip": "75001"
  },
  "shipping_address": {
    "address": "123 Main St",
    "city": "Dallas",
    "state": "Texas",
    "zip": "75001"
  }
}
```

---

## 🔍 Zoho Creator API References

| API Call | Deluge Task | Docs |
|----------|-------------|------|
| Search records with filter | `zoho.creator.getRecords()` | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/get-records.html) |
| Update a record | `zoho.creator.updateRecord()` | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/update-record.html) |
| Create a record | `zoho.creator.createRecord()` | [📖 Docs](https://www.zoho.com/deluge/help/zoho-services/creator/add-record.html) |

### Creator Filter Syntax

```javascript
// Exact match
filter = "Name == \"" + accountName + "\"";

// Numeric match
filter = "Contact_Id == \"" + contact_id + "\"";
```

---

## 🧠 Code Logic Flow

```
START
  │
  ▼
Fetch Account from CRM (getRecordById)
  │
  ▼
Build acc_map with all account fields
  │
  ▼
Search Creator: Does account exist?
  ├── YES → updateRecord in Creator ✅
  └── NO  → createRecord in Creator ✅
  │
  ▼
Build customer_map with Books fields
  │
  ▼
Search Books: Does contact exist? (GET by contact_name)
  ├── YES → PUT (update contact) ✅
  └── NO  → POST (create contact) ✅
  │
  ▼
END
```

---

## ⚠️ Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `400 Invalid value passed for JSONString` | Passing Map directly without `.toString()` | Add `.toString()` to `parameters` in invokeurl |
| `code: 3100` from Creator | Record not found | Normal — triggers create flow |
| `contacts: []` from Books | Account name not found | Normal — triggers create flow |
| `NullPointerException` on Parent_Account | Parent Account is null | Wrapped in `if != null` check ✅ |

---

## 💡 Optional Enhancement — Save Books Contact ID Back to CRM

After creating a Books contact, save the `contact_id` back to CRM for direct lookups in future:

```javascript
books_contact_id = create_customer.get("contact").get("contact_id");
update_crm = Map();
update_crm.put("Books_Contact_Id", books_contact_id);
zoho.crm.updateRecord("Accounts", account_id, update_crm);
info "Books contact_id saved to CRM: " + books_contact_id;
```

> Requires a custom field `Books_Contact_Id` (Text) on the CRM Accounts module.

---

## 📚 Additional Resources

| Resource | Link |
|----------|------|
| Zoho Deluge Help Center | [zoho.com/deluge/help](https://www.zoho.com/deluge/help/) |
| Zoho Books API v3 | [zoho.com/books/api/v3](https://www.zoho.com/books/api/v3/) |
| Zoho Creator API | [zoho.com/creator/help/api](https://www.zoho.com/creator/help/api/v2/) |
| Zoho CRM Functions | [zoho.com/crm/developer/docs/functions](https://www.zoho.com/crm/developer/docs/functions/) |
| InvokeURL Task | [zoho.com/deluge/help/webhook/invokeurl](https://www.zoho.com/deluge/help/webhook/invokeurl-api-task.html) |
| Deluge Data Types | [zoho.com/deluge/help/datatypes](https://www.zoho.com/deluge/help/datatypes.html) |
| Zoho CRM Workflow Rules | [zoho.com/crm/help/workflow-rules](https://www.zoho.com/crm/help/automation/workflow-rules.html) |
| Learn Deluge Interactive | [deluge.zoho.com/learndeluge](https://deluge.zoho.com/learndeluge) |

---

## 🤝 Contributing

Found a bug or have an improvement? Feel free to open a PR or issue.

---

## 📬 Contact

- **LinkedIn:** [Rafiullah Nikzad](https://www.linkedin.com/in/rafiullahnikzad)
- **Community:** [Zoho Afghanistan on LinkedIn](https://www.linkedin.com/groups/)
- **Portfolio:** [rafiullahnikzad.netlify.app](https://rafiullahnikzad.netlify.app)
- **GitHub:** [55+ Free Deluge Scripts](https://github.com/rafiullahnikzad)

---

*Part of the free Zoho Deluge automation scripts collection — helping businesses automate smarter.*
