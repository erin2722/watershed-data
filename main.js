const axios = require('axios');
const fs = require('fs');
const Spinner = require('cli-spinner').Spinner;

require('dotenv').config();

const APP_KEY = process.env.APP_KEY;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const BASE_URL = "https://api.constantcontact.com";

const contactOptions = {
    method: 'GET',
    url: `${BASE_URL}/v2/contacts`,
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    },
    params: {
        api_key: APP_KEY,
        status: 'ACTIVE',
    }
};

const campaignOptions = {
    method: 'GET',
    url: `${BASE_URL}/v2/emailmarketing/campaigns`,
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    },
    params: {
        api_key: APP_KEY,
        modified_since: "2020-03-25",
    }
};

const contactSummaryOptions = {
    method: 'GET',
    url: `${BASE_URL}/v2/contacts/23/tracking/reports/summaryByCampaign`,
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    },
    params: {
        api_key: APP_KEY,
    }
};

const getUsers = async () => {
    const spinner = new Spinner('Fetching Contacts.. %s');
    spinner.setSpinnerString('|/-\\');
    spinner.start();

    let contactResponseArr = [];

    let individualContactResponse;
    let next_link = '';
    let pages = 0;
    do {
        try {
            individualContactResponse = await axios(contactOptions);

            next_link = individualContactResponse.data.meta.pagination.next_link;
    
            delete contactOptions.params.status;
            contactOptions.url = `${BASE_URL}${next_link}`;
    
            pages += 1;
    
            contactResponseArr.push(...individualContactResponse.data.results);
        } catch(e) {
            pages += 1;
            console.log(e.response.status + ": " + e.response.statusText);
        }
    } while ((next_link !== null && next_link !== undefined) && pages < 1);

    spinner.stop();
    console.log('\n');
    console.log("Found " + contactResponseArr.length + " contacts.");
    return contactResponseArr;
};

const getCampaigns = async () => {
    const spinner = new Spinner('Fetching Campaigns.. %s');
    spinner.setSpinnerString('|/-\\');
    spinner.start();
    let campaignResponseArr = [];

    let individualCampaignResponse;
    let next_link = '';
    let pages = 0;
    do {
        try{
            individualCampaignResponse = await axios(campaignOptions);

            next_link = individualCampaignResponse.data.meta.pagination.next_link;
    
            delete campaignOptions.params.modified_since;
            campaignOptions.url = `${BASE_URL}${next_link}`;
    
            campaignResponseArr.push(...individualCampaignResponse.data.results);
    
            pages += 1;
        } catch(e) {
            pages += 1;
            console.log(e.response.status + ": " + e.response.statusText);
        }
    } while ((next_link !== null && next_link !== undefined) && pages < 3);

    spinner.stop();
    console.log('\n');
    return campaignResponseArr;
};

const JSONtoCSV = (json) => {
    const json_keys = Object.keys(json);
    const fields = json[json_keys[0]];
    const fieldKeys = Object.keys(fields);
    let csv = fieldKeys.join(',') + '\n';

    Object.keys(json).forEach((key) => {
        for(let property in json[key]) {
            csv += json[key][property] + ',';
        }

        csv = csv.slice(0, -1);
        csv += '\n';
    });

    return csv;
};

let output_json = {};

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}

const getUserData = async () => {
    const contacts = await getUsers();

    contacts.forEach(contact=> {
        let email = '';

        if(contact.email_addresses !== undefined && contact.email_addresses[0] !== undefined) {
            email = contact.email_addresses[0].email_address;
        }

        output_json[contact.id] = {
            email: email,
            first_name: contact.first_name,
            last_name: contact.last_name,
            clicks: 0,
            opens: 0,
            forwards: 0,
            bounces: 0,
            sends: 0,
        };
    });

    const campaigns = await getCampaigns();

    const sends = {};

    const initialCampaignSends= campaigns.filter((campaign) => {
        return campaign.name.includes("eNews") && !campaign.name.includes("Resend");
    });

    initialCampaignSends.forEach((campaign) => {
        sends[campaign.id] = campaign.name;
    });

    const resends = {};

    const campaignResends = campaigns.filter((campaign) => {
        return campaign.name.includes("eNews") && !Object.keys(sends).includes(campaign.id);
    });

    campaignResends.forEach((campaign) => {
        resends[campaign.id] = campaign.name;
    });

    console.log("------------------eNews Sends-------------------");
    console.log(sends);
    console.log("------------------eNews Resends-------------------");
    console.log(resends);

    const spinner = new Spinner('Fetching Contacts Data.. %s');
        spinner.setSpinnerString('|/-\\');
        spinner.start();

    await asyncForEach(Object.keys(output_json), async (contactId) => {
        contactSummaryOptions.url = `${BASE_URL}/v2/contacts/${contactId}/tracking/reports/summaryByCampaign`;
        try {
            let contactSummaryResponse = await axios(contactSummaryOptions);
    
            const summaries = contactSummaryResponse.data;
        
            const eNewsDataForUserSends = summaries.filter((summary) => {
                return Object.keys(sends).includes(summary.campaign_id);
            });
    
            const eNewsDataForUserResends = summaries.filter((summary) => {
                return Object.keys(resends).includes(summary.campaign_id);
            });
        
            eNewsDataForUserSends.forEach((data) => {
                output_json[data.contact_id].clicks += Number(data.clicks > 0);
                output_json[data.contact_id].opens += Number(data.opens > 0);
                output_json[data.contact_id].forwards += Number(data.forwards > 0);
                output_json[data.contact_id].bounces += data.bounces;
                output_json[data.contact_id].sends += 1;
            });
    
            eNewsDataForUserResends.forEach((data) => {
                output_json[data.contact_id].clicks += Number(data.clicks > 0);
                output_json[data.contact_id].opens += Number(data.opens > 0);
                output_json[data.contact_id].forwards += Number(data.forwards > 0);
                output_json[data.contact_id].bounces += data.bounces;
            });
        } catch(e){
            console.log(output_json[contactId].email + " " + e.response.status + ": " + e.response.statusText);
        }
    });

    spinner.stop();
    console.log('\n');

    const csv = JSONtoCSV(output_json);
    
    fs.writeFile('output.csv', csv, (err) => { 
        if (err) throw err; 
    });

    console.log("------------------JSON-------------------");
    console.log(output_json);
    console.log("------------------CSV--------------------");
    console.log(csv);
};

getUserData();
