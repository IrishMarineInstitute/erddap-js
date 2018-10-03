#!/usr/bin/env node
// kudos https://github.com/anishkny/webgif
const fs = require('fs');
const GIFEncoder = require('gifencoder');
const path = require('path');
const pngFileStream = require('png-file-stream');
const puppeteer = require('puppeteer');
const tempdir = require('tempdir');
const timeout = ms => new Promise(res => setTimeout(res, ms))


async function generateGif(browser,options){
    var url = options.url;
    var gif_filename = options.filename;
    options = options || {};
    options.duration = options.duration || 3000;
    options.viewport = options.viewport || { width: 1900,height: 1080 };
    options.clip = options.clip  || {x: 340, y: 420, width: 320, height: 240};

    const page = await browser.newPage();
    const workdir = await tempdir();

    page.setViewport(options.viewport);

    console.log(`Navigating to URL: ${url}`);
    await page.goto(url);
    await timeout(3000);
    process.stdout.write('Taking screenshots: .');
    const screenshotPromises = [];
    screenshotTaker = setInterval(async () => {
      if (page) {
        filename = `${workdir}/T${new Date().getTime()}.png`;
        process.stdout.write('.');
        var screenshot_options = {path: filename};
        if(options.clip){
          screenshot_options.clip = options.clip;
        }
        screenshotPromises.push(page.screenshot(screenshot_options));
      }
    }, 50);
    var creategif = new Promise(function(resolve,reject){
      setTimeout(async () => {
        clearInterval(screenshotTaker);
        await Promise.all(screenshotPromises);
        await page.close();
        console.log(`\nEncoding GIF: ${gif_filename}`);
        const encoder = new GIFEncoder(320, 240);
        await pngFileStream(`${workdir}/T*png`)
          .pipe(encoder.createWriteStream({ repeat: 0, delay: 60, quality: 20 }))
          .pipe(fs.createWriteStream(`${gif_filename}`));
        resolve();
      }, options.duration)

    })
    await creategif;

}
(async () => {
  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    args: ['--allow-running-insecure-content', '--disable-setuid-sandbox', '--no-sandbox', ],
  });
  if(false) await generateGif(browser,{
    url:"http://localhost/erddapjs/demo/01-leaflet-velocity/",
    filename: "demo/01-leaflet-velocity.gif",
    clip:{x: 700, y: 300, width: 320, height: 240},
    duration: 3000
  });
  if(false) await generateGif(browser,{
    url:"http://localhost/erddapjs/demo/02-leaflet-time-dimension-velocity/#autoplay",
    filename: "demo/02-leaflet-time-dimension-velocity.gif",
    clip:{x: 600, y: 400, width: 320, height: 240},
    duration: 3000
  });
  await generateGif(browser,{
    url:"http://localhost/erddapjs/demo/03-leaflet-time-dimension-wms/#autoplay",
    filename: "demo/03-leaflet-time-dimension-wms.gif",
    clip:{x: 600, y: 400, width: 320, height: 240},
    duration: 3000
  });


  await browser.close();
})();



process.on('unhandledRejection', function(reason, p) {console.log(p); process.exit(1)});
