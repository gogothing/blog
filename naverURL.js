//네이버 URL 수집기

'use strict';

var webdriver = require('selenium-webdriver');
var driver = new webdriver.Builder().forBrowser('chrome').build();
var fs = require('fs');
var moment = require('moment');
//경고표시 억제
moment.suppressDeprecationWarnings = true;
var today = moment(new Date()).format('YYYY.MM.DD HH:mm');

function replaceAt(string, index, replace) {
    return string.substring(0, index) + replace + string.substring(index + 1);
}

//월별 저장 폴더 체크 or 생성
//없으면 생성한다.
if(!fs.existsSync('./URL/' + moment(today).format('YYYYMM') )){
    fs.mkdirSync('./URL/' + moment(today).format('YYYYMM'));
}
if(!fs.existsSync('./URL/' + moment(today).subtract(1, 'days').format('YYYYMM') )){
    fs.mkdirSync('./URL/' + moment(today).subtract(1, 'days').format('YYYYMM'));
}

//다음에 url을 수집할때 중복 url을 빨리 찾울수 있도록 한다.
var todayStartFlag = true;
var yesterdayStartFlag = true;
var isTodayFirst = false;
var isYesterdayFitst = false;


var tempFile;
var overlapTodayURL;
var overlapYesterdayURL;

//오늘 파일
var todayFilePath = './URL/' + moment(today).format('YYYYMM') + '/' + moment(today).format('YYYYMMDD') + '.json';
var todayFile;
if (fs.existsSync(todayFilePath)) {
    //오늘 파일이 있으면
    todayFile = fs.readFileSync(todayFilePath, 'utf8');
    //끝 한줄 지우기
    fs.writeFileSync(todayFilePath, replaceAt(todayFile, todayFile.length - 1, ""));
    
    tempFile = JSON.parse(todayFile);
    for (var i = tempFile.length - 1; i >= 0; i--) {
        if (tempFile[i].flag !== undefined) {
            overlapTodayURL = tempFile[i].url;
            console.log('overlap 1:', overlapTodayURL);
            break;
        }
    }
} else {
    //오늘 파일이 없으면 새로 만들기
    fs.writeFileSync(todayFilePath, '[\n', 'utf8');
    //새로 넣을때 ,element...\n의 ','을 쓰지않는 플래그.
    isTodayFirst = true;
}

//어제 파일
var yesterdayFilePath = './URL/' + moment(today).subtract(1, 'days').format('YYYYMM') + '/' + moment(today).subtract(1, 'days').format('YYYYMMDD') + '.json';
var yesterDayFile;
if (fs.existsSync(yesterdayFilePath)) {
    //어제 파일이 있으면
    yesterDayFile = fs.readFileSync(yesterdayFilePath, 'utf8');
    //끝 한줄 지우기
    fs.writeFileSync(yesterdayFilePath, replaceAt(yesterDayFile, yesterDayFile.length - 1, ""));
    
    tempFile = JSON.parse(yesterDayFile);
    for(var i = tempFile.length - 1; i >= 0; i--){
        if(tempFile[i].flag === true){
            overlapYesterdayURL = tempFile[i].url;
            console.log('overlap 2:', overlapYesterdayURL);
            break;
        }
    }
} else {
    //어제 파일이 없으면 새로 만들기
    fs.writeFileSync(yesterdayFilePath, '[\n', 'utf8');
    //새로 넣을때 ,element...\n의 ','을 쓰지않는 플래그.
    isYesterdayFitst = true;
}


//페이지를 열어서 시작한다.
var pageNum = 41;
function openPage() {
    driver.get('https://section.blog.naver.com/ThemePost.nhn?directoryNo=27&activeDirectorySeq=3&currentPage=' + pageNum);
    pageNum++;

    setTimeout(loadData, 2000);
}
openPage();


async function loadData() {

    var isFin = await driver.findElement(webdriver.By.xpath("//a[@aria-current='page']"))
        .isDisplayed()
        .then(() => {
            return false;
        }).catch(() => {
            console.log('페이지 끝.');
            return true;
        });

    if(isFin){
        existCrawler();
        return;
    }

    console.log('========================================');

    for (var index = 1; index <= 10; index++) {
        var element = await new Object();

        try {
            element['url'] = await driver.findElement(webdriver.By.xpath("//div[@ng-show=\"themePostCtrl.loaded\"]/div[" + index + "]/div/div[1]/div[1]/a[1]"))
                .getAttribute('href').then(str => { return str; });

            element['title'] = await driver.findElement(webdriver.By.xpath("//div[@ng-show=\"themePostCtrl.loaded\"]/div[" + index + "]/div/div[1]/div[1]/a[1]/strong"))
                .getText().then(str => { return str; });

            //날짜는 ~시간전, ~분 전 을 처리한다.
            element['date'] = await driver.findElement(webdriver.By.xpath("//div[@ng-show=\"themePostCtrl.loaded\"]/div[" + index + "]/div/div[1]/a[1]/div[2]/span"))
                .getText().then(str => { return str; });
            if(element['date'].indexOf('시간 전') !== -1){
                element['date'] = element['date'].replace("시간 전", "");
                element['date'] = moment(today).subtract(element['date'], 'hours').format('YYYY.MM.DD');
            }else if(element['date'].indexOf('분 전') !== -1){
                element['date'] = element['date'].replace("분 전", "");
                element['date'] = moment(today).subtract(element['date'], 'minutes').format('YYYY.MM.DD');
            }else{
                existCrawler();
                return;
            }

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

            //파일을 넣기전에 중복파일인지 검사한다.
            if (element['url'] === overlapTodayURL || element['url'] === overlapYesterdayURL){
                console.log('Exit 2');
                existCrawler();
                return;
            }

                //날짜를 비교하여 어제파일, 오늘파일 중 맞는곳에 삽입한다.
                if (moment(element['date']).isSame(moment(today).format('YYYY.MM.DD'))) {
                    //오늘 날짜면
                    if (todayStartFlag) {
                        element['flag'] = true;
                        todayStartFlag = false;
                    }
                    if(isTodayFirst){
                        fs.appendFileSync(todayFilePath, JSON.stringify(element) + '\n', 'utf8');
                        isTodayFirst = false;
                    }else{
                        fs.appendFileSync(todayFilePath, ',' + JSON.stringify(element) + '\n', 'utf8');
                    }
                } else {
                    //어제 날짜면
                    if (yesterdayStartFlag) {
                        element['flag'] = true;
                        yesterdayStartFlag = false;
                    }
                    if(isYesterdayFitst){
                        fs.appendFileSync(yesterdayFilePath, JSON.stringify(element) + '\n', 'utf8');    
                        isYesterdayFitst = false;
                    }else{
                        fs.appendFileSync(yesterdayFilePath, ',' + JSON.stringify(element) + '\n', 'utf8');
                    }
                }

        } catch (err) {
            //console.log(err);
            //10개 이하이므로 종료.
            console.log('Exit 3');
            console.log('10개 이하이므로 종료합니다.');
            existCrawler();
            return;
        }
    }

    setTimeout(openPage, 1500);
}

async function existCrawler() {
    fs.appendFileSync(todayFilePath, ']', 'utf8');
    fs.appendFileSync(yesterdayFilePath, ']', 'utf8');

    await driver.close();
    await driver.quit();
    process.exit();
}
