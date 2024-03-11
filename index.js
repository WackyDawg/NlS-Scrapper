const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const ObjectsToCsv = require('objects-to-csv');

// Function to create a directory if it doesn't exist
const createDirectory = (directory) => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
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





(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // URL of the catalog page
    const catalogPageUrl = 'https://store.ui.com/us/en?category=all-unifi-cloud-gateways';

    await page.goto(catalogPageUrl);
    await page.waitForSelector('.sc-qb5aln-5');

    // Extracting product links
    const productLinks = await page.$$eval('.sc-qb5aln-5', links => links.map(link => link.href));

    for (const productLink of productLinks) {
        const productPage = await browser.newPage();
        await productPage.goto(productLink);

        // Extracting product details
        const productName = await productPage.$eval('.sc-nmmoyz-5', element => element.textContent.trim());
        const productSpecifications = await productPage.$$eval('.sc-nmmoyz-12', specifications => specifications.map(spec => spec.textContent.trim()));

        // Extracting features text
        const featuresText = await productPage.$eval('.sc-17lc73y-5', div => div.innerText.trim());

        // Scrape table data
        const tableData = await scrapeTable(productPage);

        // Creating directory for the product
        const productDirectory = path.join(__dirname, productName);
        createDirectory(productDirectory);

        // Format data for CSV
        const csvData = `Name:${productName}\nSpecifications:"${productSpecifications.join('\n\n')}"\nFeatures:"${featuresText}"\nTable Data:${JSON.stringify(tableData, null, 2)}`;

        // Save data to CSV
        const csvFilePath = path.join(productDirectory, 'product_data.csv');
        fs.writeFileSync(csvFilePath, csvData);

        console.log(`Product '${productName}' details saved in directory: ${productDirectory}`);

        await productPage.close();
    }

    await browser.close();
})();
