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

//마무리 작업
setTimeout(()=>{
    //창 종료
    //driver.quit();
    //console.log(blogList);

    //바로 스트링으로 옮긴다.
    var str = JSON.parse(fs.readFileSync('./tt.json','utf8'));
    //바로 열어버리기~
    for(var len = 0; len < 12; len++){
        driver.get(str[len]);
    }
    
}, 10000);
