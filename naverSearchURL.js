//네이버 블로그 url 수집기

'use strict';

var webdriver = require('selenium-webdriver');
var driver = new webdriver.Builder().forBrowser('chrome').build();
var fs = require('fs');
var moment = require('moment');
//경고표시 억제
moment.suppressDeprecationWarnings = true;
var today = moment(new Date()).format('YYYY.MM.DD HH:mm');

var pageNum = 1;
function openPage() {
    driver.get('https://section.blog.naver.com/ThemePost.nhn?directoryNo=27&activeDirectorySeq=3&currentPage=' + pageNum);
    pageNum++;

    setTimeout(loadData, 2000);
}
openPage();

var fileList = [];

async function loadData() {

    await driver.findElement(webdriver.By.xpath("//a[@aria-current='page']"))
    .isDisplayed()
    .then(()=>{
    }).catch(()=>{
        console.log('페이지 끝.');
        programFin();
    })

    console.log('========================================');

    for (var index = 1; index <= 10; index++) {
        var element = await new Object();

        try {
            element['url'] = await driver.findElement(webdriver.By.xpath("//div[@ng-show=\"themePostCtrl.loaded\"]/div[" + index + "]/div/div[1]/div[1]/a[1]"))
                .getAttribute('href').then(str => { return str; });

            element['title'] = await driver.findElement(webdriver.By.xpath("//div[@ng-show=\"themePostCtrl.loaded\"]/div[" + index + "]/div/div[1]/div[1]/a[1]/strong"))
                .getText().then(str => { return str; });

            //날짜는 ~시간전 을 처리한다.
            element['date'] = await driver.findElement(webdriver.By.xpath("//div[@ng-show=\"themePostCtrl.loaded\"]/div[" + index + "]/div/div[1]/a[1]/div[2]/span"))
                .getText().then(str => { return str; });
            element['date'] = element['date'].replace("시간 전", "");
            element['date'] = moment(today).subtract(element['date'], 'hours').format('YYYY.MM.DD');

            element['name'] = await driver.findElement(webdriver.By.xpath("//div[@ng-show=\"themePostCtrl.loaded\"]/div[" + index + "]/div/div[1]/a[1]/div[2]/em"))
                .getText().then(str => { return str; });

            //블로그에 따라 공감수, 댓글수가 없을때도 있음.
            try {
                element['symCount'] = await driver.findElement(webdriver.By.xpath("//div[@ng-show=\"themePostCtrl.loaded\"]/div[" + index + "]/div/div[1]/div[2]/span[1]/em"))
                    .getText().then(str => { return str; });
            } catch (err) {
                element['symCount'] = 0;
            }
            //블로그에 따라 공감수, 댓글수가 없을때도 있음.
            try {
                element['cmtCount'] = await driver.findElement(webdriver.By.xpath("//div[@ng-show=\"themePostCtrl.loaded\"]/div[" + index + "]/div/div[1]/div[2]/span[2]/em"))
                    .getText().then(str => { return str; });
            } catch (err) {
                element['cmtCount'] = 0;
            }

            console.log('blog:', element['title']);

            var fileName = await moment(element['date']).format('YYYYMM') + '.json';
            //처음 넣는다면
            if (fileList.indexOf(fileName) === -1) {
                await fileList.push(fileName);
                fs.writeFileSync('./URL/' + fileName, '[\n' + JSON.stringify(element) + '\n', 'utf8');
            }
            //처음이 아닐경우
            else {
                fs.appendFileSync('./URL/' + fileName, ',' + JSON.stringify(element) + '\n', 'utf8');
            }

        } catch (err) {
            console.log(err);
            //10개 이하이므로 종료.
            programFin();
            break;
        }
    }

    setTimeout(openPage, 1500);
}

function programFin() {
    var FileLen = fileList[fileList.length - 1];
    fs.appendFileSync('./URL/' + FileLen, ']', 'utf8');

    driver.close();
    driver.quit();
    process.exit();
}
