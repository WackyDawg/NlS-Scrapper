const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Function to create a directory if it doesn't exist
const createDirectory = (directory) => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
};

const scrapeTable = async (page) => {
    return await page.evaluate(() => {
        const tableData = {};
        const tables = Array.from(document.querySelectorAll('.data-table'));

        tables.forEach(table => {
            const category = table.querySelector('th').textContent.trim();
            tableData[category] = {};

            let currentCategory = null; // Store the current category temporarily

            Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
                // If the row has a th, update the current category
                const th = row.querySelector('th');
                if (th) {
                    currentCategory = th.textContent.trim();
                    tableData[category][currentCategory] = {};
                } else {
                    // Otherwise, add the key-value pair to the current category
                    const cells = Array.from(row.querySelectorAll('td'));
                    if (cells.length === 2 && currentCategory) {
                        const key = cells[0].textContent.trim();
                        const value = cells[1].textContent.trim();
                        tableData[category][currentCategory][key] = value;
                    }
                }
            });
        });

        return tableData;
    });
};

const scrapeAddons = async (page) => {
    return await page.evaluate(() => {
        const addonsData = [];
        const addons = Array.from(document.querySelectorAll('.dLWjTj'));

        addons.forEach(addon => {
            const addonName = addon.querySelector('.sc-nmmoyz-5').textContent.trim();
            const addonPrice = addon.querySelector('.sc-nmmoyz-8').textContent.trim();
            const addonSpecifications = Array.from(addon.querySelectorAll('.sc-nmmoyz-12')).map(spec => spec.textContent.trim());

            addonsData.push({
                name: addonName,
                price: addonPrice,
                specifications: addonSpecifications
            });
        });
        console.log(addonsData)

        return addonsData;
    });
};

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // URL of the catalog page
    const catalogPageUrl = 'https://store.ui.com/us/en?category=accessories-cables-dacs';

    await page.goto(catalogPageUrl);
    await page.waitForSelector('.sc-qb5aln-5');

    // Extracting product links
    const productLinks = await page.$$eval('.sc-qb5aln-5', links => links.map(link => link.href));

    for (const productLink of productLinks) {
        const productPage = await browser.newPage();
        await productPage.goto(productLink);

        // Extracting product details
        const productName = await productPage.$eval('.sc-nmmoyz-5', element => element.textContent.trim());
        const productPrice = await productPage.$eval('.sc-nmmoyz-8', element => element.textContent.trim());
        const productSpecifications = await productPage.$$eval('.sc-nmmoyz-12', specifications => specifications.map(spec => spec.textContent.trim()));

        // Extracting features text
        const featuresText = await productPage.$eval('.sc-17lc73y-5', div => div.innerText.trim());

        // Scrape table data
        const tableData = await scrapeTable(productPage);

        // Scrape addons data
        const addonsData = await scrapeAddons(productPage);

        // Creating directory for the product
        const productDirectory = path.join(__dirname, './ubiquiti_accessories', productName);
        createDirectory(productDirectory);

        // Format data for CSV
        const csvData = `Name: ${productName}\nPrice: ${productPrice}\nProduct URL: ${productLink}\nSpecifications: "${productSpecifications.join('\n\n')}"\nFeatures: "${featuresText}"\nTable Data: ${JSON.stringify(tableData, null, 2)}\nAddons: ${JSON.stringify(addonsData, null, 2)}`;

        // Save data to CSV
        const csvFilePath = path.join(productDirectory, 'product_data.csv');
        fs.writeFileSync(csvFilePath, csvData);

        console.log(`Product '${productName}' details saved in directory: ${productDirectory}`);
        //console.log(productLink);

        await productPage.close();
    }

    await browser.close();
})();
