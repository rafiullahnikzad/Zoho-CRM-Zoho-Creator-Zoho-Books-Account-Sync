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