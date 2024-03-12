const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function cloneWebsite(url, outputDir) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Wait for the page to load completely by scrolling
        await page.evaluate(async () => {
            await new Promise((resolve, reject) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Get HTML content
        let html = await page.content();

        // Modify base URL for local resources
        html = html.replace(/(href|src)=("|')([^"']+)/g, (match, p1, p2, p3) => {
            if (p3.startsWith('http') || p3.startsWith('//')) {
                return match;
            }
            return `${p1}=${p2}${path.join('assets', p3)}`;
        });

        // Create output directory if it doesn't exist
        const assetsDir = path.join(outputDir, 'assets');
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }

        // Save HTML
        fs.writeFileSync(path.join(outputDir, 'index.html'), html);

        // Save other assets (CSS, JS, images, etc.)
        const assetUrls = await page.evaluate(() => {
            const assets = [];
            document.querySelectorAll('link[rel="stylesheet"], script[src], img[src]').forEach(element => {
                assets.push(element.href || element.src);
            });
            return assets;
        });

        for (const assetUrl of assetUrls) {
            const response = await page.goto(assetUrl);
            const buffer = await response.buffer();
            const assetPath = assetUrl.replace(url, '').split('?')[0]; // remove query string
            fs.writeFileSync(path.join(assetsDir, assetPath), buffer);
        }

        console.log('Website cloned successfully!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

// Usage example
const websiteUrl = 'https://www.aliexpress.com/';
const outputDirectory = 'cloned_website';

cloneWebsite(websiteUrl, outputDirectory);
