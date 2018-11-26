'use strict';

var webdriver = require('selenium-webdriver');
var driver = new webdriver.Builder().forBrowser('chrome').build();
var fs = require('fs');
var moment = require('moment');
//경고표시 억제
moment.suppressDeprecationWarnings = true;

//lastMonth까지 모음.
var lastMonth = process.argv[2];
lastMonth = moment(lastMonth).format('YYYY.MM');

//티스토리 국내여행 블로그를 엽니다.
(async function start() {
    await driver.get('https://tistory.com/category/travel/abroad');
    console.log('loaded');
    setTimeout(loadData, 5000);
})();

var urlStart = 1;
var urlLast = 9;

//로드된 url의 첫번째부터 마지막것까지 로드, 저장한다.
const loadData = async () => {

    try{
        var date = await driver.findElement(webdriver.By.xpath("//ul[@class=\"list_tistory\"]/li[" + urlStart + "]/a/div[@class=\"wrap_cont\"]/div[@class=\"info_g\"]/span[@class=\"txt_date\"]"))
        .getText().then(str => { return str; });
        
        //console.log(date);

        if (moment(lastMonth).isSameOrBefore(moment(date).format('YYYY.MM'), 'month')) {
            for (urlStart; urlStart <= urlLast; urlStart++) {
                console.log('find: li[' + urlStart + ']');
                //저장할 url데이터 크롤링, 저장
                await searchElement(urlStart);
            }
            driver.executeScript("window.scroll(0, document.body.scrollHeight);");
            urlLast += 12;
            setTimeout(() => {
                loadData();
            }, 2000);
        }
        else {
            try {
                //json파일을 완성시키고 프로그램을 종료합니다.
                for (var fileNum = 0; fileNum < fileList.length; fileNum++) {
                    fs.appendFileSync('./URL/' + fileList[fileNum], ']', 'utf8');
                }
    
                console.log('종료시점', urlStart);
                driver.close();
                driver.quit();
                process.exit();
            }
            catch (err) {
                console.error(err);
            }
        }

    }catch(err){
        console.error('!not load', urlStart);
        setTimeout(loadData, 2000);
    }

}


/*
    url				  a href
	제목               a/div .wrap_cont/span .inner_desc_tit inner_desc_tit2 (getText)
	날짜+시간			a/div .wrap_cont/div .info_g/span .txt_date (getText)
	작성자             a/div .wrap_cont/div .info_g/span .txt_id (getText)
    
	글 종류(해외여행, 국내여행, 맛집..)	a/dl .list_data/dd .txt_cate txt_cate_type1/span .inner_data (getText)
	공감수				a/dl .list_data/dd .num_cmt (getText)
*/

//파일 리스트는 이름에 확장자도 포함됩니다.
var fileList = [];

async function searchElement(index) {
    var element = await new Object();

    //url, 제목, 날짜, 공감 수
    element['url'] = await driver.findElement(webdriver.By.xpath("//ul[@class=\"list_tistory\"]/li[" + index + "]/a"))
        .getAttribute('href').then(str => { return str; })

    element['title'] = await driver.findElement(webdriver.By.xpath("//ul[@class=\"list_tistory\"]/li[" + index + "]/a/div[@class=\"wrap_cont\"]/strong[@class=\"desc_tit\"]/span[@class=\"inner_desc_tit inner_desc_tit2\"]"))
        .getText().then(str => { return str; })

    element['date'] = await driver.findElement(webdriver.By.xpath("//ul[@class=\"list_tistory\"]/li[" + index + "]/a/div[@class=\"wrap_cont\"]/div[@class=\"info_g\"]/span[@class=\"txt_date\"]"))
        .getText().then(str => { return str; })

    element['name'] = await driver.findElement(webdriver.By.xpath("//ul[@class=\"list_tistory\"]/li[" + index + "]/a/div[@class=\"wrap_cont\"]/div[@class=\"info_g\"]/span[@class=\"txt_id\"]"))
        .getText().then(str => { return str; })

    element['type'] = await driver.findElement(webdriver.By.xpath("//ul[@class=\"list_tistory\"]/li[" + index + "]/a/dl[@class=\"list_data\"]/dd[@class=\"txt_cate txt_cate_type1\"]/span[@class=\"inner_data\"]"))
        .getText().then(str => { return str; })

    element['sym'] = await driver.findElement(webdriver.By.xpath("//ul[@class=\"list_tistory\"]/li[" + index + "]/a/dl[@class=\"list_data\"]/dd[@class=\"num_cmt\"]"))
        .getText().then(str => { return str; })

    //console.log(element);

    //저장할 파일의 이름
    var fileName = await moment(element['date']).format('YYYYMM') + '.json';
    console.log('idx    :', fileName);
    console.log(element);

    //처음 넣는다면
    if (fileList.indexOf(fileName) === -1) {
        await fileList.push(fileName);
        fs.writeFileSync('./URL/' + fileName, '[\n' + JSON.stringify(element) + '\n', 'utf8');
    }
    //처음이 아닐경우
    else {
        fs.appendFileSync('./URL/' + fileName, ',' + JSON.stringify(element) + '\n', 'utf8');
    }
}
