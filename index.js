const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Function to create a directory if it doesn't exist
const createDirectory = async (directory) => {
    try {
        await fs.mkdir(directory, { recursive: true });
    } catch (error) {
        throw new Error(`Error creating directory: ${error.message}`);
    }
};

const scrapeContentNotes = async (page) => {
    return await page.evaluate(() => {
        const contentNotes = Array.from(document.querySelectorAll('.overview-content-note p'));
        const notes = contentNotes.map(note => note.textContent.trim());
        return notes.join('\n');
    });
};

const scrapeTable = async (page) => {
    return await page.evaluate(() => {
        const tableData = {};
        const tables = Array.from(document.querySelectorAll('.sp-wrap table'));

        tables.forEach(table => {
            const categoryName = table.querySelector('thead th').textContent.trim();
            tableData[categoryName] = {};

            const rows = Array.from(table.querySelectorAll('tbody tr'));
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('th, td'));
                const key = cells[0].textContent.trim();
                const value = cells[1].innerHTML.replace(/<br>/g, '\n').trim();
                tableData[categoryName][key] = value;
            });
        });

        return tableData;
    });
};


const scrapeAddons = async (page) => {
    return page.evaluate(() => {
        const addonsData = [];
        const addons = Array.from(document.querySelectorAll('.dLWjTj'));

        addons.forEach(addon => {
            const addonName = addon.querySelector('.title').textContent.trim();
            const addonSpecifications = Array.from(addon.querySelectorAll('.sc-nmmoyz-12')).map(spec => spec.textContent.trim());

            addonsData.push({
                name: addonName,
                specifications: addonSpecifications
            });
        });

        return addonsData;
    });
};

const scrapeImages = async (page, productDirectory) => {
    const imageSelectors = '.thumb-pic'; // Selector for the images
    const imagePaths = [];

    const images = await page.$$eval(imageSelectors, imgs => {
        return imgs.map(img => img.style.backgroundImage.match(/url\("([^"]+)"/)[1]);
    });

    for (let i = 0; i < images.length; i++) {
        try {
            const imageUrl = images[i];
            const imagePath = path.join(productDirectory, `image_${i + 1}.png`);
            const response = await page.goto(imageUrl);
            await fs.writeFile(imagePath, await response.buffer());
            imagePaths.push(imagePath);
            console.log(`Image ${i + 1} saved: ${imagePath}`);
        } catch (error) {
            console.log(`Error saving image ${i + 1}: ${error.message}`);
        }
    }

    return imagePaths;
};

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // URL of the catalog page
    const catalogPageUrl = 'https://service-provider.tp-link.com/wifi-router/?p=2#product';

    try {
        await page.goto(catalogPageUrl);
        await page.waitForSelector('.product-link');

        // Extracting product links
        const productLinks = await page.$$eval('.product-link', links => links.map(link => link.href));

        for (const productLink of productLinks) {
            const productPage = await browser.newPage();
            await productPage.goto(productLink);

            try {
                // Extracting product details
                const productName = await productPage.$eval('.title', element => element.textContent.trim());
                const productModel = await productPage.$eval('.model', element => element.textContent.trim());
                const productSpecifications = await productPage.$$eval('.sc-nmmoyz-12', specifications => specifications.map(spec => spec.textContent.trim()));

                // Scrape table data
                const tableData = await scrapeTable(productPage);

                // Scrape addons data
                const addonsData = await scrapeAddons(productPage);

                // Scrape highlights
                const highlights = await productPage.$eval('.highlights', div => div.innerText.trim());
                const contentNotes = await scrapeContentNotes(productPage);

                // Creating directory for the product
                const productDirectory = path.join(__dirname, './TP-Link 4G/5G Router', productName);
                await createDirectory(productDirectory);

                // Save images
                const imagePaths = await scrapeImages(productPage, productDirectory);

                // Format data for CSV
                const csvData = `Name: ${productName}\nPrice: N/a\nModel: ${productModel}\nSpecifications: "${productSpecifications.join('\n\n')}"\nTable Data: ${JSON.stringify(tableData, null, 2)}\nAddons: ${JSON.stringify(addonsData, null, 2)}\nImages: ${imagePaths.join(', ')}\nHighlights: ${highlights}\n Content Notes: ${contentNotes}`;

                // Save data to CSV
                const csvFilePath = path.join(productDirectory, 'product_data.csv');
                await fs.writeFile(csvFilePath, csvData);

                console.log(`Product '${productName}' details saved in directory: ${productDirectory}`);
            } catch (error) {
                console.log(`Error processing product: ${error.message}`);
            }

            await productPage.close();
        }
    } catch (error) {
        console.log(`Error accessing catalog page: ${error.message}`);
    } finally {
        await browser.close();
    }
})();
