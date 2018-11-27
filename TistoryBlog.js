//한 블로그의 데이터를 긁어옵니다.
'use strict';

var webdriver = require('selenium-webdriver');
var driver = new webdriver.Builder().forBrowser('chrome').build();
driver.manage().window().setRect({ height: 240, width: 320, x: 0, y: 0 });
var fs = require('fs');
var moment = require('moment');
var imgDownloader = require('image-downloader');
//경고표시 억제
moment.suppressDeprecationWarnings = true;

//해당 블로그url json을 엽니다.
var JSONFile = fs.readFileSync("./daumURL/" + process.argv[2], "utf8");
JSONFile = JSON.parse(JSONFile);
var imgFolderPath = '';

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

//이미지를 저장하는폴더의 상위폴더를 만듭니다.
//ex) 201709 => ./contents/201709/
var destFile = './contents/imgs/' + process.argv[2].replace('.json', "");
if (!fs.existsSync(destFile)) {
    fs.mkdirSync(destFile);
}
// 블로그데이터 저장파일 초기화
fs.writeFileSync('./contents/' + process.argv[2], '[', function (err) {
    if (err) {
        console.error('초기화:', err);
        // 노드 종료하기
        process.exit();
        return;
    }
});

var retry = 0;
var jsonCount = 0;
var url = '';

//창을 열고 10초후 분석시작.
async function getWindow() {
    retry = 5;
    //더이상 파일이 json파일을 완성하고 없으면 종료.
    console.log('FILE[',jsonCount,']');
    if (JSONFile[jsonCount] === undefined) {
        console.error('FILE FIN');
        fs.appendFileSync('./contents/'+process.argv[2], ']');
        existCrawler();
        return;
    }

    url = JSONFile[jsonCount].url;
    try{
        await driver.get(JSONFile[jsonCount].url);
    }catch(err){
        console.error('Retry:',retry+1, 'URL:',url);
        console.error(err);
        console.error('===================================');
        if(retry < 5){
            retry++;
            getWindow();
        }else{
            console.error('jsonCount:', jsonCount, 'not load:', url);
            retry = 0;
            jsonCount++;
            getWindow();
        }
    }

    //블로그가 로드됐는지 확인.
    //setTimeout(checkBlog, 8000);
    checkBlog();
};
getWindow();

//블로그가 로드됐는지 확인하기 위해 잘못 로드됐다는 것이 띄워졌는지 확인.
function checkBlog() {
    //우선 공감태그를 찾는다.
    driver.findElement(webdriver.By.xpath("//span[@class=\"txt_like uoc-count\"]"))
        .getText()
        .then(() => {
            collect();
        }, () => {
            driver.findElement(webdriver.By.xpath("//div[@class=\"absent_post\"]"))
                .getText()
                .then(str => {
                    //무효url확정, 로그 url을 띄우고 다음 진행.
                    if (str === '잘못된 주소이거나, 비공개 또는 삭제된 글입니다') {
                        console.error('삭제됐거나 무효한 주소:', url);
                        jsonCount++;
                        getWindow();
                    }
                }, () => {
                    //무효url도 아니면 10초후 5번 다시 시도.
                    if (retry > 0) {
                        retry--;
                        setTimeout(() => {
                            console.error('딜레이!:', url);
                            checkBlog();
                        }, 10000);
                    }
                    //5번 기다려도 안되면 에러로그에 남기기.
                    else if (retry === 0) {
                        console.error('로딩!:   ', url);
                        jsonCount++;
                        getWindow();
                    }
                });
        });
}


/**
 * 블로그의 데이터를 수집합니다.
 * 찾을 데이터는 이렇습니다.           패턴 수
 * 1. 제목      title               1
 * 2. 본문      body                3
 * 3. 날짜      date                5
 * 4. 태그      tag                 29  
 * 5. 댓글 수   commentCount        3
 * 6. 공감 수   sympathyCount       1
 */

var BlogContent;
async function collect() {

    BlogContent = new Object();
    //url은 makeImgFolderName 에서 저장한다.

    BlogContent['blogURL'] = url;
    BlogContent['title'] = -1;
    BlogContent['date'] = JSONFile[jsonCount].date;
    BlogContent['name'] = -1;
    BlogContent['tag'] = [];
    BlogContent['commentCount'] = -1;
    BlogContent['sympathyCount'] = -1;

    BlogContent['imgURL'] = [];
    BlogContent['body'] = -1;
    BlogContent['HTMLbody'] = -1;

    console.log('\n수집시작: ', url);

    //폴더를 만들고 본문 읽기.
    await makeImgFolder();
    //makeImgFolderName에서 findBody 호출됨.
    findName();
    findTitle();
    findTag();
    findCommentCount();
    findSympath();
    // 노드 종료하기
    setTimeout(saveData, 5000);
}

async function existCrawler() {
    await driver.close();
    await driver.quit();
    process.exit();
}

////////////////////////////////////

async function makeImgFolder() {

    imgFolderPath = destFile + '/' + jsonCount;

    //이미지 폴더가 없으면 생성.
    if (!fs.existsSync(imgFolderPath)) {
        fs.mkdirSync(imgFolderPath);
    }
    await findBody();
}

async function findTitle() {
    console.log('제목0');
    var str = JSONFile[jsonCount].title;
    if (str.lastIndexOf('..') !== -1) {
        var _start = str.lastIndexOf('..');
        str = str.substr(0, _start);

        driver.findElement(webdriver.By.xpath('//body'))
            .getAttribute('innerHTML')
            .then(html => {
                //url제목을 가져와 문장끝의 점 2개를 제거하고
                //바디 태그에서 innerhtml로 전부 가져와
                //url에서 가져온 제목으로 indexof로 제목의 시작점을 정의하고
                //시작점부터 태그의 끝부분을 찾는다.
                //시작점과 끝부분을 찾으면 subString으로 제목을 추출해낸다.
                var titleStart = html.indexOf(str);
                var titleEnd = html.indexOf('</', titleStart);

                //제목 뽑아내기
                BlogContent['title'] = html.substring(titleStart, titleEnd);
            });
    } else {
        BlogContent['title'] = JSONFile[jsonCount].title;
    }
}

async function findName() {
    await driver.findElement(webdriver.By.xpath("//meta[@name=\"by\"]"))
        .getAttribute('content')
        .then(str => {
            BlogContent['name'] = str;
        }, err => {
            console.error('이름!', url);
        })
}


//본문, 이미지 저장은 한쌍이다.
async function findBody() {
    console.log('본문1');
    await driver.findElement(webdriver.By.xpath("//div[@class=\"tt_article_useless_p_margin\"]"))
        .getAttribute("innerHTML")
        .then(element => {
            BlogContent['body'] = element;
            BlogContent['HTMLbody'] = element;

            replaceBody();
        }, err => { findBody2(); });
    await findImg();
}

//이미지 URL저장, 이미지 다운로드.
async function findImg() {
    console.log('이미지1');
    await driver.findElements(webdriver.By.xpath("//div[@class=\"tt_article_useless_p_margin\"]//img"))
        .then(element => {
            BlogContent['imagePath'] = jsonCount;
            asyncForEach(element, function (source, index) {
                //이미지 저장코드.
                source.getAttribute('src')
                    .then(imgUrl => {
                        BlogContent['imgURL'].push(imgUrl);
                        (async () => {
                            await imgDownloader.image({ url: imgUrl, dest: imgFolderPath })
                                .then(({ fileName }) => {
                                    console.log('Downloaded:', fileName);
                                });
                        })();
                    });
            });
        }).catch(err => {
            console.error('findImg1 Err:', err);
        });
}

function findBody2() {
    console.log('본문2');
    driver.findElement(webdriver.By.xpath("//div[@class=\"article\"]"))
        .getAttribute("innerHTML")
        .then(element => {
            BlogContent['body'] = element;
            BlogContent['HTMLbody'] = element;

            replaceBody();
            findImg2();
        }, err => { findBody3(); });
}

async function findImg2() {
    console.log('이미지2');
    driver.findElements(webdriver.By.xpath("//div[@class=\"article\"]//img"))
        .then(element => {
            BlogContent['imagePath'] = jsonCount;
            asyncForEach(element, function (source, index) {

                //이미지 저장코드.
                try {
                    source.getAttribute('src')
                        .then(imgUrl => {
                            BlogContent['imgURL'].push(imgUrl);

                            (async () => {
                                console.log('Downlaod Start', imgUrl);
                                await imgDownloader.image({ url: imgUrl, dest: imgFolderPath });
                            })();
                        })
                } catch (err) {
                    console.error(index, '2_imgDownload Fail: ', source);
                }

            });
        }).catch(err => {
            console.error('findImg2 Err:', err);
        });
}

function findBody3() {
    console.log('본문3');
    driver.findElement(webdriver.By.xpath("//div[@class=\"area_view\"]"))
        .getAttribute("innerHTML")
        .then(element => {
            BlogContent['body'] = element;
            BlogContent['HTMLbody'] = element;

            replaceBody();
            findImg3();
        }, err => { findBody4(); });
}

async function findImg3() {
    console.log('이미지3');
    driver.findElements(webdriver.By.xpath("//div[@class=\"area_view\"]//img"))
        .then(element => {
            BlogContent['imagePath'] = jsonCount;
            asyncForEach(element, function (source, index) {

                //이미지 저장코드.
                try {
                    source.getAttribute('src')
                        .then(imgUrl => {
                            BlogContent['imgURL'].push(imgUrl);

                            console.log('Downlaod Start', imgUrl);
                            (async () => {
                                await imgDownloader.image({ url: imgUrl, dest: imgFolderPath });
                            })();

                        })
                } catch (err) {
                    console.error(index, '3_imgDownload Fail: ', source);
                }

            });
        }).catch(err => {
            console.error('findImg1 Err:', err);
        });

}

function findBody4() {
    console.log('본문4');
    driver.findElement(webdriver.By.xpath("//article[@id=\"article\"]"))
        .getAttribute("innerHTML")
        .then(element => {
            BlogContent['body'] = element;
            BlogContent['HTMLbody'] = element;

            replaceBody();
            findImg4();
        }, err => { 
            findBody5();
            //console.error('본문!   ', url); 
        });
}

async function findImg4() {
    console.log('이미지4');
    driver.findElements(webdriver.By.xpath("//article[@id=\"article\"]//img"))
        .then(element => {
            BlogContent['imagePath'] = jsonCount;
            asyncForEach(element, function (source, index) {

                //이미지 저장코드.
                try {
                    source.getAttribute('src')
                        .then(imgUrl => {
                            BlogContent['imgURL'].push(imgUrl);

                            (async () => {
                                console.log('Downlaod Start', imgUrl);
                                await imgDownloader.image({ url: imgUrl, dest: imgFolderPath });
                            })();
                        })
                } catch (err) {
                    console.error(index, '4_imgDownload Fail: ', source);
                }

            });
        }).catch(err => {
            console.error('findImg4 Err:', err);
        });
}

function findBody5() {
    console.log('본문5');
    driver.findElement(webdriver.By.xpath("//div[@class=\"jb-content jb-content-article\"]"))
        .getAttribute("innerHTML")
        .then(element => {
            BlogContent['body'] = element;
            BlogContent['HTMLbody'] = element;

            replaceBody();
            findImg5();
        }, err => { findBody6(); });
}

async function findImg5() {
    console.log('이미지5');
    driver.findElements(webdriver.By.xpath("//div[@class=\"jb-content jb-content-article\"]//img"))
        .then(element => {
            BlogContent['imagePath'] = jsonCount;
            asyncForEach(element, function (source, index) {

                //이미지 저장코드.
                try {
                    source.getAttribute('src')
                        .then(imgUrl => {
                            BlogContent['imgURL'].push(imgUrl);

                            (async () => {
                                console.log('Downlaod Start', imgUrl);
                                await imgDownloader.image({ url: imgUrl, dest: imgFolderPath });
                            })();
                        })
                } catch (err) {
                    console.error(index, '5_imgDownload Fail: ', source);
                }

            });
        }).catch(err => {
            console.error('findImg5 Err:', err);
        });
}

function findBody6() {
    console.log('본문6');
    driver.findElement(webdriver.By.xpath("//div[@class=\"article_content\"]"))
        .getAttribute("innerHTML")
        .then(element => {
            BlogContent['body'] = element;
            BlogContent['HTMLbody'] = element;

            replaceBody();
            findImg6();
        }, err => { findBody7(); });
}

async function findImg6() {
    console.log('이미지6');
    driver.findElements(webdriver.By.xpath("//div[@class=\"article_content\"]//img"))
        .then(element => {
            BlogContent['imagePath'] = jsonCount;
            asyncForEach(element, function (source, index) {

                //이미지 저장코드.
                try {
                    source.getAttribute('src')
                        .then(imgUrl => {
                            BlogContent['imgURL'].push(imgUrl);

                            (async () => {
                                console.log('Downlaod Start', imgUrl);
                                await imgDownloader.image({ url: imgUrl, dest: imgFolderPath });
                            })();
                        })
                } catch (err) {
                    console.error(index, '6_imgDownload Fail: ', source);
                }

            });
        }).catch(err => {
            console.error('findImg6 Err:', err);
        });
}

function findBody7() {
    console.log('본문7');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry-content\"]/div"))
        .getAttribute("innerHTML")
        .then(element => {
            BlogContent['body'] = element;
            BlogContent['HTMLbody'] = element;

            replaceBody();
            findImg7();
        }, err => { findBody8(); });
}

async function findImg7() {
    console.log('이미지7');
    driver.findElements(webdriver.By.xpath("//div[@class=\"entry-content\"]/div//img"))
        .then(element => {
            BlogContent['imagePath'] = jsonCount;
            asyncForEach(element, function (source, index) {

                //이미지 저장코드.
                try {
                    source.getAttribute('src')
                        .then(imgUrl => {
                            BlogContent['imgURL'].push(imgUrl);

                            (async () => {
                                console.log('Downlaod Start', imgUrl);
                                await imgDownloader.image({ url: imgUrl, dest: imgFolderPath });
                            })();
                        })
                } catch (err) {
                    console.error(index, '7_imgDownload Fail: ', source);
                }

            });
        }).catch(err => {
            console.error('findImg7 Err:', err);
        });
}

function findBody8() {
    console.log('본문8');
    driver.findElement(webdriver.By.xpath("//div[@class=\"content-wrap limit-width\"]/article[@class=\"article \"]"))
        .getAttribute("innerHTML")
        .then(element => {
            BlogContent['body'] = element;
            BlogContent['HTMLbody'] = element;

            replaceBody();
            findImg8();
        }, err => { console.error('본문!   ', url); });
}

async function findImg8() {
    console.log('이미지8');
    driver.findElements(webdriver.By.xpath("//div[@class=\"content-wrap limit-width\"]/article[@class=\"article \"]//img"))
        .then(element => {
            BlogContent['imagePath'] = jsonCount;
            asyncForEach(element, function (source, index) {

                //이미지 저장코드.
                try {
                    source.getAttribute('src')
                        .then(imgUrl => {
                            BlogContent['imgURL'].push(imgUrl);

                            (async () => {
                                console.log('Downlaod Start', imgUrl);
                                await imgDownloader.image({ url: imgUrl, dest: imgFolderPath });
                            })();
                        })
                } catch (err) {
                    console.error(index, '8_imgDownload Fail: ', source);
                }

            });
        }).catch(err => {
            console.error('findImg8 Err:', err);
        });
}

//태그
async function findTag() {
    console.log('태그1');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tagTrail\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tagTrail\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                }).catch(err => {
                    console.error('tag1ErrCatch', url);
                    console.error(err);
                });
        }, err => { findTag2(); })
}

function findTag2() {
    console.log('태그2');
    driver.findElement(webdriver.By.xpath("//div[@id=\"content\"]/div[@class=\"tagTrail\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@id=\"content\"]/div[@class=\"tagTrail\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag3(); })
}

function findTag3() {
    console.log('태그3');
    driver.findElement(webdriver.By.xpath("//div[@class=\"area_etc\"]/dl[@class=\"list_tag\"]/dd"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"area_etc\"]/dl[@class=\"list_tag\"]/dd/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            }).catch(err => {
                                console.error('ErrUrl:', url);
                                console.error(err);
                            })
                    })
                });
        }, err => { findTag4(); })
}

function findTag4() {
    console.log('태그4');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tag_label\"]"))
        .then(str => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tag_label\"]/span/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag5(); })
}

function findTag5() {
    console.log('태그5');
    driver.findElement(webdriver.By.xpath("//div[@class=\"tagTrail\"]/span[@class=\"tags\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"tagTrail\"]/span[@class=\"tags\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag6(); })
}

function findTag6() {
    console.log('태그6');
    driver.findElement(webdriver.By.xpath("//div[@class=\"media\"]/div[@class=\"media-body\"]"))
        .then(() => {
            console.log('태그6 사용됨', url);
            driver.findElements(webdriver.By.xpath("//div[@class=\"media\"]/div[@class=\"media-body\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag7(); })
}

function findTag7() {
    console.log('태그7');
    driver.findElement(webdriver.By.xpath("//div[@class=\"tagTrail\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"tagTrail\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            }).catch(err=>{
                                console.log(url, 'tag7 Err');
                            })
                    })
                });
        }, err => { findTag8(); })
}

function findTag8() {
    console.log('태그8');
    driver.findElement(webdriver.By.xpath("//article/div[@class=\"media\"]/div[@class=\"media-body\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//article/div[@class=\"media\"]/div[@class=\"media-body\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag9(); });
}

function findTag9() {
    console.log('태그9');
    driver.findElement(webdriver.By.xpath("//p[@class=\"jb-article-tag\"]/span[@class=\"jb-article-tag-list\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//p[@class=\"jb-article-tag\"]/span[@class=\"jb-article-tag-list\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag10(); });
}

function findTag10() {
    console.log('태그10');
    driver.findElement(webdriver.By.xpath("//article[@class=\"article_main\"]/div[@class=\"bot_article\"]/div[@class=\"gly-article_tags\"]/span[@class=\"article_tags\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//article[@class=\"article_main\"]/div[@class=\"bot_article\"]/div[@class=\"gly-article_tags\"]/span[@class=\"article_tags\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag11(); });
}

function findTag11() {
    console.log('태그11');
    driver.findElement(webdriver.By.xpath("//article[@class=\"contents\"]/section[@class=\"tag_list\"]/p/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//article[@class=\"contents\"]/section[@class=\"tag_list\"]/p/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag12(); });
}

function findTag12() {
    console.log('태그12');
    driver.findElement(webdriver.By.xpath("//article[@class=\"contents\"]/section[@class=\"tag_list\"]/p/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//article[@class=\"contents\"]/section[@class=\"tag_list\"]/p/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag13(); });
}

function findTag13() {
    console.log('태그13');
    driver.findElement(webdriver.By.xpath("//article[@id=\"article\"]/div[@class=\"tag-trail\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//article[@id=\"article\"]/div[@class=\"tag-trail\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag14(); });
}

function findTag14() {
    console.log('태그14');
    driver.findElement(webdriver.By.xpath("//article[@class=\"contents\"]/section[@class=\"tag-list\"]/p/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//article[@class=\"contents\"]/section[@class=\"tag-list\"]/p/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag15(); });
}

function findTag15() {
    console.log('태그15');
    driver.findElement(webdriver.By.xpath("//div[@class=\"article\"]/div[@class=\"article_tag\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"article\"]/div[@class=\"article_tag\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag16(); });
}

function findTag16() {
    console.log('태그16');
    driver.findElement(webdriver.By.xpath("//div[@id=\"article\"]/div[@class=\"posttag\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@id=\"article\"]/div[@class=\"posttag\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag17(); });
}

function findTag17() {
    console.log('태그17');
    driver.findElement(webdriver.By.xpath("//div[@class=\"article\"]/div[@class=\"wrap_tagbox\"]/ul/li/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"article\"]/div[@class=\"wrap_tagbox\"]/ul/li/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag18(); });
}

function findTag18() {
    console.log('태그18');
    driver.findElement(webdriver.By.xpath("//div[@class=\"article\"]/div[@class=\"wrap_tagbox\"]/ul/li/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"article\"]/div[@class=\"wrap_tagbox\"]/ul/li/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag19(); });
}

function findTag19() {
    console.log('태그19');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"entrayContentsWrap\"]/div[@class=\"tagTrail\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"entrayContentsWrap\"]/div[@class=\"tagTrail\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag20(); });
}

function findTag20() {
    console.log('태그20');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"entry-content\"]/div[@class=\"entry-tags\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"entry-content\"]/div[@class=\"entry-tags\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag21(); });
}

function findTag21() {
    console.log('태그21');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tagbox\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tagbox\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag22(); });
}

function findTag22() {
    console.log('태그22');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tagTrail floatWrapper\"]/span[@class=\"tagText\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tagTrail floatWrapper\"]/span[@class=\"tagText\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag23(); });
}

function findTag23() {
    console.log('태그23');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry-content\"]/div[@class=\"entry-tags\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"entry-content\"]/div[@class=\"entry-tags\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag24(); });
}

function findTag24() {
    console.log('태그24');
    driver.findElement(webdriver.By.xpath("//div[@id=\"content-inner\"]/div[@class=\"entry\"]/div[@class=\"tag_label\"]/span/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@id=\"content-inner\"]/div[@class=\"entry\"]/div[@class=\"tag_label\"]/span/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag25(); });
}

function findTag25() {
    console.log('태그25');
    driver.findElement(webdriver.By.xpath("//div[@id=\"mArticle\"]/div[@class=\"area_etc\"]"))
        .getText()
        .then(str => {
            if (str === '') BlogContent['tag'] = 'NoTag25';
            else {
                driver.findElements(webdriver.By.xpath("//div[@id=\"mArticle\"]/div[@class=\"area_etc\"]/div[@class=\"list_tag\"]/dd/a"))
                    .then(element => {
                        element.forEach((value, index) => {
                            value.getText()
                                .then(str => {
                                    BlogContent['tag'].push(str);
                                })
                        })
                    });
            }
        }, err => { findTag26(); });
}

function findTag26() {
    console.log('태그26');
    driver.findElement(webdriver.By.xpath("//div[@class=\"article_tag\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"article_tag\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag27(); });
}

function findTag27() {
    console.log('태그27');
    driver.findElement(webdriver.By.xpath("//div[@class=\"sidebar_plus_tag\"]/div[@class=\"tagcloud\"]/ul/li/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"sidebar_plus_tag\"]/div[@class=\"tagcloud\"]/ul/li/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag28(); });
}

function findTag28() {
    console.log('태그28');
    driver.findElement(webdriver.By.xpath("//div[@class=\"wrap_tagbox\"]/ul/li/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"wrap_tagbox\"]/ul/li/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag29(); });
}

function findTag29() {
    console.log('태그29');
    driver.findElement(webdriver.By.xpath("//section[@class=\"entry-section tag\"]/div[@class=\"section-content\"]/a/span[@clas\"locationTag\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//section[@class=\"entry-section tag\"]/div[@class=\"section-content\"]/a/span[@clas\"locationTag\"]"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag30(); });
}

function findTag30() {
    console.log('태그30');
    driver.findElement(webdriver.By.xpath("//div[@class=\"clearfix\"]/div[contains(@class, 'article-tag')]/p[@class=\"tags\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"clearfix\"]/div[contains(@class, 'article-tag')]/p[@class=\"tags\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag31(); });
}

function findTag31() {
    console.log('태그31');
    driver.findElement(webdriver.By.xpath("//dd[@class=\"tag_item_list\"]/span[@class=\"tag_item\"]/a"))
        .getText()
        .then(str => {
            driver.findElements(webdriver.By.xpath("//dd[@class=\"tag_item_list\"]/span[@class=\"tag_item\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag32(); });
}

function findTag32() {
    console.log('태그32');
    driver.findElement(webdriver.By.xpath("//div[@class=\"tagTrail\"]/span[@class=\"tagtext\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"tagTrail\"]/span[@class=\"tagtext\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag33(); });
}

function findTag33() {
    console.log('태그33');
    driver.findElement(webdriver.By.xpath("//div[contains(@class, 'tagTrail')]/span[@class=\"tagText\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[contains(@class, 'tagTrail')]/span[@class=\"tagText\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag34(); });
}

function findTag34() {
    console.log('태그34');
    driver.findElement(webdriver.By.xpath("//div[@class=\"tagtrail\"]/div[@class=\"listTag2\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"tagtrail\"]/div[@class=\"listTag2\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag35(); });
}

function findTag35() {
    console.log('태그35');
    driver.findElement(webdriver.By.xpath("//div[@id=\"entry\"]/div[@id=\"tagTrail\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@id=\"entry\"]/div[@id=\"tagTrail\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag36(); });
}

function findTag36() {
    console.log('태그36');
    driver.findElement(webdriver.By.xpath("//div[@class=\"area_etc\"]/dl[@class=\"list_tag\"]/dd[@class=\"desc_tag\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"area_etc\"]/dl[@class=\"list_tag\"]/dd[@class=\"desc_tag\"]/a"))
                .then(element => {
                    if (element.length === 0) {
                        BlogContent['tag'] = 'NoTag36';
                    } else {
                        element.forEach((value, index) => {
                            value.getText()
                                .then(str => {
                                    BlogContent['tag'].push(str);
                                })
                        })
                    }
                });
        }, err => { findTag37(); });
}

function findTag37() {
    console.log('태그37');
    driver.findElement(webdriver.By.xpath("//div[contains(@class, 'tags-link-wrap')]/div[@class=\"tags-wrap\"]/span[@class=\"tags\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[contains(@class, 'tags-link-wrap')]/div[@class=\"tags-wrap\"]/span[@class=\"tags\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag38(); });
}

function findTag38() {
    console.log('태그38');
    driver.findElement(webdriver.By.xpath("//div[@class=\"articlebgbottom\"]/div[@class=\"article_bottom\"]/div[@class=\"tag_box\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"articlebgbottom\"]/div[@class=\"article_bottom\"]/div[@class=\"tag_box\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag39(); });
}

function findTag39() {
    console.log('태그39');
    driver.findElement(webdriver.By.xpath("//div[@class=\"articleInfo\"]/ul/li[@class=\"tagTrail\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"articleInfo\"]/ul/li[@class=\"tagTrail\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag40(); });
}

function findTag40() {
    console.log('태그40');
    driver.findElement(webdriver.By.xpath("//div[@class=\"wrapEntryCnt\"]/div[@class=\"tagTrail\"]/div[@class=\"cnt\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"wrapEntryCnt\"]/div[@class=\"tagTrail\"]/div[@class=\"cnt\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag41(); });
}

function findTag41() {
    console.log('태그41');
    driver.findElement(webdriver.By.xpath("//div[@class=\"content\"]/div[@class=\"container\"]/div[@class=\"postTag\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"content\"]/div[@class=\"container\"]/div[@class=\"postTag\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag42(); });
}

function findTag42() {
    console.log('태그42');
    driver.findElement(webdriver.By.xpath("//div[@class=\"article_etc\"]/div[@class=\"article_tag\"]/span/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"article_etc\"]/div[@class=\"article_tag\"]/span/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag43(); });
}

function findTag43() {
    console.log('태그43');
    driver.findElement(webdriver.By.xpath("//div[@class=\"post-meta-bottom\"]/div[@class=\"post-cat-tags\"]/p[@class=\"post-tags\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"post-meta-bottom\"]/div[@class=\"post-cat-tags\"]/p[@class=\"post-tags\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag44(); });
}

function findTag44() {
    console.log('태그44');
    driver.findElement(webdriver.By.xpath("//section[@class=\"content-tags\"]/span[@class=\"tag-links\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//section[@class=\"content-tags\"]/span[@class=\"tag-links\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag45(); });
}

function findTag45() {
    console.log('태그45');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tag\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"tag\"]/a"))
                .then(element => {
                    if (element.length === 0) {
                        BlogContent['tag'] = 'NoTag45';
                    } else {
                        element.forEach((value, index) => {
                            value.getText()
                                .then(str => {
                                    BlogContent['tag'].push(str);
                                })
                        })
                    }
                });
        }, err => { findTag46(); });
}

function findTag46() {
    console.log('태그46');
    driver.findElement(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"article-tags\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"entry\"]/div[@class=\"article-tags\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag47(); });
}

function findTag47() {
    console.log('태그47');
    driver.findElement(webdriver.By.xpath("//div[@class=\"posttag\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"posttag\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag48(); });
}

function findTag48() {
    console.log('태그48');
    driver.findElement(webdriver.By.xpath("//section[contains(@class, 'entry-tags')]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//section[contains(@class, 'entry-tags')]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag49(); });
}

function findTag49() {
    console.log('태그49');
    driver.findElement(webdriver.By.xpath("//section[@class=\"entry-tags\"]/a"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//section[@class=\"entry-tags\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                });
        }, err => { findTag50(); });
}

function findTag50() {
    console.log('태그50');
    driver.findElement(webdriver.By.xpath("//div[@class=\"tags\"]/div[@class=\"items\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"tags\"]/div[@class=\"items\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                })
        },err=> { findTag51(); })
}

function findTag51() {
    console.log('태그51');
    driver.findElement(webdriver.By.xpath("//div[@class=\"article_content\"]/div[@class=\"area_tag\"]/div[@class=\"tag_content\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"article_content\"]/div[@class=\"area_tag\"]/div[@class=\"tag_content\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                })
        },err=> { findTag52(); })
}

function findTag52() {
    console.log('태그52');
    driver.findElement(webdriver.By.xpath("//main[@class=\"content\"]/section[@class=\"entry-section tag\"]/div[@class=\"section-content\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//main[@class=\"content\"]/section[@class=\"entry-section tag\"]/div[@class=\"section-content\"]/a"))
                .then(element => {
                    element.forEach((value, index) => {
                        value.getText()
                            .then(str => {
                                BlogContent['tag'].push(str);
                            })
                    })
                })
        }, err => { console.error('태그!   ', url); })
}



//댓글 수
async function findCommentCount() {
    console.log('댓글1');
    try{
        await driver.findElement(webdriver.By.xpath("//a[@href=\"#rp\"]/span[starts-with(@id,'commentCount')]/span[@class=\"cnt\"]"))
        .getText()
        .then(cnt => {
            BlogContent['commentCount'] = cnt;
        });
    }catch(err){
        findCommentCount2();
    }
}

async function findCommentCount2() {
    console.log('댓글2');
    try{
        await driver.findElement(webdriver.By.xpath("//a[@href=\"#rp\"]/span[starts-with(@id,'commentCount')]"))
        .getText()
        .then(cnt => {
            BlogContent['commentCount'] = cnt;
        });
    }catch(err){
        findCommentCount3();
    }
}

async function findCommentCount3() {
    console.log('댓글3');
    try{
        await driver.findElement(webdriver.By.xpath("//span[starts-with(@id,'commentCount')]"))
        .getText()
        .then(cnt => {
            BlogContent['commentCount'] = cnt;
        });
    }catch(err){
        findCommentCount4();
    }
}

//이 댓글수는 댓글수가 띄워지지 않음.따라서 findelements로 직접 셈.
async function findCommentCount4() {
    console.log('댓글4');
    try{

        await driver.findElement(webdriver.By.xpath("//div[@class=\"comments\"]/ol/li//div[@class=\"comment-info\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"comments\"]/ol/li//div[@class=\"comment-info\"]"))
            .then(elements => {
                BlogContent['commentCount'] = elements.length;
            })
        });
    }catch(err){
        findCommentCount5();
    }
}

//이 댓글수는 댓글수가 띄워지지 않음.따라서 findelements로 직접 셈.
async function findCommentCount5() {
    console.log('댓글5');
    try{
        await driver.findElement(webdriver.By.xpath("//div[@class=\"communicateList\"]/ol/li//div[@class=\"control\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"communicateList\"]/ol/li//div[@class=\"control\"]"))
            .then(elements => {
                BlogContent['commentCount'] = elements.length;
            })
        });
    }catch(err){
        findCommentCount6();
    }
}

//이 댓글수는 댓글수가 띄워지지 않음.따라서 findelements로 직접 셈.
async function findCommentCount6() {
    console.log('댓글6');
    try{

        await driver.findElement(webdriver.By.xpath("//div[@class=\"author-meta\"]"))
        .then(() => {
            driver.findElements(webdriver.By.xpath("//div[@class=\"author-meta\"]"))
            .then(elements => {
                BlogContent['commentCount'] = elements.length;
            })
        });
    }catch(err){
        console.error('댓글!   ', url);
    }
}

function replaceBody() {
    console.log('replaceBody call');
    var body = BlogContent['body'];

    if (body === -1) {
        return;
    }
    //console.error('전: ',body);

    //개행제거
    body = body.replace(/\n/g, "");
    //body = body.replace(/<script[^>]*>.*<\/script>/gm, "");     //자바스크립트 제거
    //body = body.replace(/<ins[^>]*>.*<\/ins>/gm, "");
    //주석삭제
    //body = body.replace(/<!--.*-->/gm, "");
    //같은블로그, 다른 글들.
    body = body.replace(/<div class="another_category[^>]*>.*<\/div>/gm, "");
    //공유 버튼(카카오스토리, 트위터, 페북)
    body = body.replace(/<div class="tt-plugin tt-share-entry-with-sns[^>]*>.*<\/div>/gm, "");
    //공감버튼, 권리표시
    body = body.replace(/<div class="container_postbtn"[^>]*>.*<\/div>/gm, "");


    body = body.replace(/<(\/p|p)([^>]*)>/g, "");                //p태그 제거
    body = body.replace(/<style[^>]*>.*<\/style>/gm, "");

    body = body.replace(/<(span|\/span)([^>]*)>/g, "");          //span
    body = body.replace(/<(img)([^>]*)>/g, "");

    body = body.replace(/(<br>|< br>|<\/br>|<\/ br>)/g, "\n");  //br태그 제거
    body = body.replace(/&nbsp;/g, " ");                        //개행문자 변경



    body = body.replace(/<div class="tt_adsense[^>]*>.*<\/div>/g, "");
    //기타 태그들은 이걸로 삭제한다.
    body = body.replace(/<\/?[^>]+(>|$)/g, "");

    //console.log('후: ',body);
    BlogContent['body'] = body;

    console.log('replaceBody Fin');
}

async function findSympath() {
    console.log('공감0');
    try{
        await driver.findElement(webdriver.By.xpath("//div[@class=\"postbtn_like\"]/label"))
        .getText()
        .then(str => {
            BlogContent['sym'] = str;
        })
    }catch(err){
        console.error('공감!: ',url);
    }
}

var isFirstData = true;
function saveData() {
    console.log('SAVE:', BlogContent);
    BlogContent = JSON.stringify(BlogContent);

    //처음에만 작동.
    if (isFirstData) {
        //파일 덧붙이기.
        fs.appendFileSync('./contents/' + process.argv[2], BlogContent, function (err) {
            if (err) {
                console.error('파일1:', err);
                existCrawler();
                return;
            }
        });
        isFirstData = false;
    }
    else {
        //파일 덧붙이기.
        fs.appendFileSync('./contents/' + process.argv[2], ',\n' + BlogContent, function (err) {
            if (err) {
                console.error('파일2:', err);
                existCrawler();
                return;
            }
        });
    }

    jsonCount++;
    setTimeout(getWindow, 1000);
}
