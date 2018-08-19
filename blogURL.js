'use strict';


var webdriver = require( 'selenium-webdriver' );
var fs = require('fs');

var driver = new webdriver.Builder().forBrowser( 'chrome' ).build();

var blogList = [];

//티스토리 국내여행 블로그를 엽니다.
driver.get('https://tistory.com/category/travel/domestic');

setTimeout(() => {
    driver.findElements( webdriver.By.xpath( '//ul[@id=\"categoryPostWrap\"]/li/a' ) ).then( blogElement => {
        //console.log( '블로그 URL count: ', blogElement.length,'\n', blogElement);
        
        blogElement.forEach(function(val){
            val.getAttribute('href')
            .then(hrefString =>{
                //console.log('블로그 url: ',hrefString);
                blogList.push(hrefString);
                })
            }, err=>{ console.log('블로그 수집오류',err); 
        })
    }, err=>{ console.log('알수없는 오류'); 
    })
}, 5000);



setTimeout(()=>{
    driver.quit();
    var str = JSON.stringify(blogList, null, '\t');
    console.log(str);
    fs.writeFile('tt.json', str, (err)=>{
        console.log('쓰기 성공', err);
    })
    //console.log(blogList);
}, 10000);
