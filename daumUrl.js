//다음 검색 - 국내여행 의 결과를 가져옵니다.

'use strict';

var webdriver = require('selenium-webdriver');
var driver = new webdriver.Builder().forBrowser('chrome').build();
driver.manage().window().setRect({ height: 240, width: 320, x: 0, y: 0 });
var fs = require('fs');
var moment = require('moment');
//경고표시 억제
moment.suppressDeprecationWarnings = true;

//날짜입력: 201702~201802
//lastMonth까지 모음.
var startDay = moment(process.argv[2].split('~')[0], 'YYYYMM').format('YYYYMM')+'01';
var lastDay = moment(process.argv[2].split('~')[1], 'YYYYMM').format('YYYYMM');
//상대적 시간표현(~분전, ~시간전)을 처리.
var today = moment(new Date()).format('YYYY.MM.DD HH:mm');
var nowMonth = moment(startDay, 'YYYYMMDD').format('YYYYMM');

//lastDay가 오늘날짜를 초과하면 오늘날짜로 초기화한다.
if(moment(lastDay).isAfter(moment(today).format('YYYYMM'), 'day')){
    console.log('날짜를 초과합니다.', moment(today).format('YYYYMMDD'), '로 바뀝니다.');
    lastDay = moment(today).format('YYYYMMDD');
}
console.log(startDay, lastDay, nowMonth);

var pageNum = 1;
//다음 검색 - 출처:티스토리
async function start() {
    await driver.get('https://search.daum.net/search?w=blog&enc=utf8&q=%EA%B5%AD%EB%82%B4%EC%97%AC%ED%96%89&f=section&SA=tistory&sd='+ startDay + '000000&ed='+ startDay + '235959&period=u&sort=recency&page=' + pageNum + '&DA=STC');
    pageNum++;

    //아래로 스크롤
    //driver.executeScript("window.scroll(0, document.body.scrollHeight);");

    console.log('loaded');
    loadData();
}
start();

//파일 리스트는 이름에 확장자도 포함됩니다.
var fileList = [];

async function loadData() {
    for (var i = 1; i <= 10; i++) {
        var element = new Object();
        try {
            element['url'] = await driver.findElement(webdriver.By.xpath("//div[@id='blogColl']/div/ul[@class=\"list_info mg_cont clear\"]/li[" + i + "]/div[@class=\"wrap_cont\"]/div/div[2]/span/a[1]"))
                .getAttribute('href').then(str => { return str; });

            element['title'] = await driver.findElement(webdriver.By.xpath("//div[@id='blogColl']/div/ul[@class=\"list_info mg_cont clear\"]/li[" + i + "]/div[@class=\"wrap_cont\"]/div/div[1]/a"))
                .getText().then(str => { return str; });

            element['date'] = await driver.findElement(webdriver.By.xpath("//div[@id='blogColl']/div/ul[@class=\"list_info mg_cont clear\"]/li[" + i + "]/div[@class=\"wrap_cont\"]/div/span"))
                .getText().then(str => { return str; });

            //~분전, ~시간전 을 처리.
            if (element['date'].indexOf('분전') !== -1) {
                element['date'] = moment(today).subtract(element['date'], 'm').format('YYYY.MM.DD');
            }else if(element['date'].indexOf('시간전') !== -1){
                element['date'] = moment(today).subtract(element['date'], 'h').format('YYYY.MM.DD');
            }

            element['name'] = await driver.findElement(webdriver.By.xpath("//div[@id='blogColl']/div/ul[@class=\"list_info mg_cont clear\"]/li[" + i + "]/div[@class=\"wrap_cont\"]/div/div[2]/span/a[2]"))
                .getText().then(str => { return str; });
        } catch (err) {
            console.error('last index:',i ,'finish element, date:',startDay);
            break;
        }
        //저장할 파일의 이름
        var fileName = moment(element['date']).format('YYYYMM') + '.json';
        console.log('date    :', fileName);
        //console.log(element);

        //처음 넣는다면
        if (fileList.indexOf(fileName) === -1) {
            fileList.push(fileName);
            fs.writeFileSync('./daumURL/' + fileName, '[\n' + JSON.stringify(element) + '\n', 'utf8');
        }
        //처음이 아닐경우
        else {
            fs.appendFileSync('./daumURL/' + fileName, ',' + JSON.stringify(element) + '\n', 'utf8');
        }
    }

    //다음 검색페이지는 다음 버튼을 클릭하면 +1 페이지로 넘어간다.
    //클릭 버튼 유무에 따라 태그자체가 바뀐다. 따라서 태그 구분만 가능하면 가능.
    //더보기 클릭할수 없는 버튼.
    var isFin = await driver.findElement(webdriver.By.xpath("//span[@class='btn_page btn_next']"))
        .isDisplayed().catch(() => { return false });

    //다음달로 넘어갈때 ]을 붙인다. 아니면 일수만 증가시키고 진행.
    //다음 페이지가 없을때 if문 실행.
    if (isFin) {
        //지정한 날짜가 다 되면 종료.
        //아니면 startDay를 증가시키고 다음 시작, pageNum 초기화.
        var tempLastDay = (moment(lastDay, 'YYYYMMDD').add(1, 'months').subtract(1, 'days')).format('YYYYMMDD');
        console.log('1:', startDay, ',2:', tempLastDay);
        if(moment(startDay).isSame(tempLastDay, 'day')){
            console.log('종료시점');
            await driver.close();
            await driver.quit();
            process.exit();
        }else{
            startDay = moment(startDay).add(1,'days').format('YYYYMMDD');

            //다음달로 넘어가기 직전에 ']' 붙임.
            console.log('nowMonth:', nowMonth, ' startDay:', startDay);
            if(!moment(nowMonth).isSame(moment(startDay, 'YYYYMMDD').format('YYYYMM'), 'month')){
                console.log(startDay,'종료. 다음달 시작');
                fs.appendFileSync('./daumURL/' + nowMonth + '.json', ']', 'utf8');

                nowMonth = moment(startDay, 'YYYYMMDD').format('YYYYMM');
            }

            pageNum = 1;
            console.log(startDay,'로 넘어감.');
            start();
        }
    } else {
        console.log('else process');
        start();
    }
}
