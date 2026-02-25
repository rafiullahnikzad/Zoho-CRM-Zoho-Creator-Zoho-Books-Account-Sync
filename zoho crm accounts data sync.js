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
