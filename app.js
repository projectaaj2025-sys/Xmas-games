(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const modal = $('#gameModal');
  const content = $('#modalContent');
  const toast = $('#toast');
  let toastTimeout;
  let syncSocket, pendingState, screenCount = 0, connectedPlayers = [], syncAvailable = true;
  const roomCode = (()=>{ const bytes=new Uint8Array(8); if(window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes); else for(let i=0;i<8;i++) bytes[i]=Math.random()*256; return [...bytes].map(n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join(''); })();
  let shareBaseUrl=new URL('.',location.href);
  let displayUrl=new URL(`display.html?room=${roomCode}`,shareBaseUrl).href;
  let memoryState, guessState, crocState, quizState, crosswordState;
  let localAddressAvailable=true;
  const onlineSync=location.protocol==='https:' && typeof window.StaticSync==='function';
  const appPageUrl=path=>new URL(path,shareBaseUrl).href;
  async function discoverShareOrigin(){
    if(onlineSync) return shareBaseUrl.href;
    try{
      const response=await fetch('/api/network-info',{cache:'no-store'});if(!response.ok)throw new Error('LAN API unavailable');
      const info=await response.json();
      if(['localhost','127.0.0.1','::1'].includes(location.hostname)){
        if(info.addresses?.length)shareBaseUrl=new URL(`http://${info.addresses[0]}:${location.port||info.port}/`);
        else localAddressAvailable=false;
      }
    }catch{}
    displayUrl=appPageUrl(`display.html?room=${roomCode}`);
    return shareBaseUrl.href;
  }
  const shareOriginReady=discoverShareOrigin();

  const aiCardArt = {
    'Ёлка':'assets/tree-card.webp','Подарок':'assets/gift-card.webp','Снеговик':'assets/snowman-card.webp','Олень':'assets/reindeer-card.webp','Северный олень':'assets/reindeer-card.webp',
    'Варежки':'assets/mittens-card.webp','Сани':'assets/sled-card.webp','Снежинка':'assets/snowflake-card.webp','Санки':'assets/sled-card.webp','Колокольчик':'assets/bell-card.webp','Мандарин':'assets/mandarin-card.webp',
    'Снегирь':'assets/bullfinch-card.webp','Щелкунчик':'assets/nutcracker-card.webp','Снегурочка':'assets/snowmaiden-card.webp','Дед Мороз':'assets/dedmoroz-card.webp','Снежная сова':'assets/memo-snowy-owl-card.webp','Зимняя сова':'assets/memo-snowy-owl-card.webp','Сова':'assets/memo-snowy-owl-card.webp','Пряничный человечек':'assets/tarantinki-gingerbread-card.webp','Имбирный пряник':'assets/tarantinki-gingerbread-card.webp','Имбирное печенье':'assets/tarantinki-gingerbread-card.webp','Печенье':'assets/tarantinki-gingerbread-card.webp','Белый медведь':'assets/polar-bear-card.webp','Пингвин':'assets/penguin-card.webp','Снежный шар':'assets/snow-globe-card.webp','Салат оливье':'assets/olivier-salad-card.webp','Фонарик':'assets/winter-lantern-card.webp','Носок у камина':'assets/christmas-stocking-card.webp','Письмо':'assets/letter-to-santa-card.webp','Иней':'assets/frost-window-card.webp','Мишура':'assets/festive-garland-card.webp','Ёлочная игрушка':'assets/ornament-card.webp','Мороз':'assets/blizzard-card.webp','Морозный узор':'assets/frost-window-card.webp','Ёлочный шар':'assets/ornament-card.webp','Гирлянда':'assets/festive-garland-card.webp','Зайчик':'assets/winter-bunny-card.webp','Заяц':'assets/winter-bunny-card.webp','Свеча':'assets/winter-candle-card.webp','Какао':'assets/cocoa-mug-card.webp','Сапожок':'assets/christmas-stocking-card.webp','Рождественский носок':'assets/christmas-stocking-card.webp','Сосновая шишка':'assets/pine-cone-card.webp','Звезда':'assets/golden-star-card.webp','Полярная звезда':'assets/golden-star-card.webp','Рождественская звезда':'assets/golden-star-card.webp','Сосулька':'assets/icicle-card.webp','Ледяная сосулька':'assets/icicle-card.webp','Лыжи':'assets/skier-card.webp','Лыжник':'assets/skier-card.webp','Снегоступы':'assets/snowshoes-card.webp','Северное сияние':'assets/northern-lights-card.webp','Снежная крепость':'assets/snow-fort-card.webp','Шарф':'assets/winter-scarf-card.webp','Снежный шарф':'assets/winter-scarf-card.webp','Тёплый шарф':'assets/winter-scarf-card.webp','Хлопушка':'assets/party-popper-card.webp','Подарочная лента':'assets/gift-ribbon-card.webp','Шапка':'assets/winter-hat-card.webp','Варежка':'assets/mittens-card.webp','Снегокат':'assets/sled-card.webp','Коньки':'assets/ice-skates-card.webp','Леденец':'assets/peppermint-lollipop-card.webp','Снежный ком':'assets/snowball-card.webp','Зимний сапог':'assets/winter-boot-card.webp','Валенки':'assets/winter-boot-card.webp','Чайник':'assets/teapot-card.webp','Лошадка-качалка':'assets/rocking-horse-card.webp','Письмо Деду Морозу':'assets/letter-to-santa-card.webp','Метель':'assets/blizzard-card.webp','Камин':'assets/fireplace-card.webp','Рождественский венок':'assets/christmas-wreath-card.webp','Подарочная коробка':'assets/gift-box-card.webp','Рождественский ангел':'assets/christmas-angel-card.webp'
  };
  const memoryDeck = [
    ['Ёлка','🎄'],['Подарок','🎁'],['Снеговик','⛄'],['Олень','🦌'],['Варежки','🧤'],['Снежинка','❄️'],['Санки','🛷'],['Колокольчик','🔔'],['Ёлочный шар','🔴'],['Имбирный пряник','🍪'],['Звезда','⭐'],['Мандарин','🍊'],['Сапожок','🧦'],['Свеча','🕯️'],['Сосулька','🧊'],['Зайчик','🐇'],['Коньки','⛸️'],['Снежный шар','🔮'],['Гирлянда','💡'],['Снегирь','🐦'],['Леденец','🍭'],['Щелкунчик','🪆'],['Подарочная лента','🎀'],['Фонарик','🏮'],['Пингвин','🐧'],['Шапка','🧢'],['Снежный ком','⚪'],['Зимний сапог','🥾'],['Чайник','🫖'],['Какао','☕'],['Печенье','🍪'],['Полярная звезда','🌟'],['Лошадка-качалка','🧸'],['Письмо Деду Морозу','✉️'],['Северное сияние','🌌'],['Белый медведь','🐻‍❄️'],['Сосновая шишка','🌰'],['Снежная крепость','🏰'],['Метель','🌨️'],['Камин','🔥'],['Снегоступы','🎿'],['Хлопушка','🎉'],['Рождественский венок','🌿'],['Северный олень','🦌'],['Тёплый шарф','🧣'],['Лыжи','🎿'],['Снежная сова','🦉'],['Подарочная коробка','📦'],['Морозный узор','❄️'],['Рождественский носок','🧦']
  ].map(([name, emoji], design) => ({ name, emoji, design:design%6, image: aiCardArt[name] || '' }));


  const photoMemoryDeck = [
    {name:'Ёлка',emoji:'🎄',image:'assets/memo-photo-tree.webp'},
    {name:'Ёлочный шар',emoji:'🔴',image:'assets/memo-photo-ornament.webp'},
    {name:'Мандарин',emoji:'🍊',image:'assets/memo-photo-mandarins.webp'},
    {name:'Подарок',emoji:'🎁',image:'assets/memo-photo-gift.webp'},
    {name:'Домик в снегу',emoji:'🏠',image:'assets/memo-photo-cabin.webp'},
    {name:'Носок у камина',emoji:'🧦',image:'assets/memo-photo-stocking.webp'},
    {name:'Сани с подарками',emoji:'🛷',image:'assets/memo-photo-sleigh.webp'},
    {name:'Свеча',emoji:'🕯️',image:'assets/memo-photo-candle.webp'},
    {name:'Колокольчик',emoji:'🔔',image:'assets/memo-photo-chimes.webp'},
    {name:'Имбирное печенье',emoji:'🍪',image:'assets/memo-photo-gingerbread.webp'},
    {name:'Снеговик',emoji:'⛄',image:'assets/memo-photo-snowman.webp'},
    {name:'Сосновая шишка',emoji:'🌰',image:'assets/memo-photo-pinecone.webp'},
    {name:'Фейерверк',emoji:'🎆',image:'assets/memo-photo-fireworks.webp'},
    {name:'Варежки',emoji:'🧤',image:'assets/memo-photo-mittens.webp'},
    {name:'Салат оливье',emoji:'🥗',image:'assets/memo-photo-olivier.webp'},
    {name:'Олень',emoji:'🦌',image:'assets/memo-photo-reindeer.webp'},
    {name:'Свечи у окна',emoji:'🕯️',image:'assets/memo-photo-window.webp'},
    {name:'Письмо Деду Морозу',emoji:'✉️',image:'assets/memo-photo-letter.webp'},
    {name:'Часы',emoji:'🕛',image:'assets/memo-photo-clock.webp'},
    {name:'Валенки',emoji:'🥾',image:'assets/memo-photo-valenki.webp'},
    {name:'Щелкунчик',emoji:'🪆',image:'assets/memo-photo-nutcracker.webp'},
    {name:'Мишура',emoji:'✨',image:'assets/memo-photo-tinsel.webp'},
    {name:'Календарь',emoji:'📆',image:'assets/memo-photo-calendar.webp'},
    {name:'Хоровод',emoji:'💃',image:'assets/memo-photo-khorovod.webp'},
    {name:'Шапка',emoji:'🧢',image:'assets/memo-photo-hat.webp'},
    {name:'Хлопушка',emoji:'🎉',image:'assets/memo-photo-cracker.webp'},
    {name:'Снежный шар',emoji:'🔮',image:'assets/memo-photo-snowglobe.webp'},
    {name:'Бенгальские огни',emoji:'✨',image:'assets/memo-photo-sparklers.webp'},
    {name:'Звезда на ёлке',emoji:'⭐',image:'assets/memo-photo-star.webp'},
    {name:'Рождественский венок',emoji:'🌿',image:'assets/memo-photo-wreath.webp'},
    {name:'Самовар',emoji:'🫖',image:'assets/memo-photo-samovar.webp'},
    {name:'Леденец-трость',emoji:'🍭',image:'assets/memo-photo-candycane.webp'},
    {name:'Новогодняя открытка',emoji:'💌',image:'assets/memo-photo-postcard.webp'},
    {name:'Фонарик',emoji:'🏮',image:'assets/memo-photo-lantern.webp'},
    {name:'Какао',emoji:'☕',image:'assets/memo-photo-cocoa.webp'},
    {name:'Лошадка-качалка',emoji:'🧸',image:'assets/memo-photo-rockinghorse.webp'},
    {name:'Снежинка',emoji:'❄️',image:'assets/memo-photo-paper-snowflake.webp'},
    {name:'Гирлянда',emoji:'💡',image:'assets/memo-photo-garland-lights.webp'},
    {name:'Яблоки',emoji:'🍎',image:'assets/memo-photo-apples.webp'},
    {name:'Конфеты',emoji:'🍬',image:'assets/memo-photo-candies.webp'},
    {name:'Кот у ёлки',emoji:'🐈',image:'assets/memo-photo-cat.webp'},
    {name:'Чайник',emoji:'🫖',image:'assets/memo-photo-teapot.webp'},
    {name:'Игрушечный паровозик',emoji:'🚂',image:'assets/memo-photo-toytrain.webp'},
    {name:'Праздничная площадь',emoji:'🏙️',image:'assets/memo-photo-citysquare.webp'},
    {name:'Хвоя и корица',emoji:'🌿',image:'assets/memo-photo-cinnamon.webp'},
    {name:'Семейный ужин',emoji:'🍽️',image:'assets/memo-photo-familytable.webp'},
    {name:'Бумажная гирлянда',emoji:'🎊',image:'assets/memo-photo-paperchain.webp'},
    {name:'Новогодняя ярмарка',emoji:'🎪',image:'assets/memo-photo-market.webp'},
    {name:'Снегирь',emoji:'🐦',image:'assets/memo-photo-bullfinch.webp'},
    {name:'Карнавальная маска',emoji:'🎭',image:'assets/memo-photo-masquerade.webp'}
  ].map((card,index)=>({...card,design:index%6}));
  const memoQuestions = [
    {kind:'choice',prompt:'Сколько виноградин принято съедать под бой часов в испанской новогодней традиции?',options:['12','7','3'],correct:0},
    {kind:'tf',prompt:'В Японии накануне Нового года едят длинную лапшу тосикоси-соба как пожелание долгой жизни.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'В честь какого римского бога назван январь?',options:['Януса','Марса','Нептуна'],correct:0},
    {kind:'choice',prompt:'В каком веке по указу Петра I в России начали встречать Новый год 1 января?',options:['В XVIII веке','В XVII веке','В XIX веке'],correct:0},
    {kind:'tf',prompt:'Фейерверки и пороховые хлопушки исторически связаны с древним Китаем.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'В какой стране в праздничный пирог василопиту кладут монетку на удачу?',options:['В Греции','В Норвегии','В Канаде'],correct:0},
    {kind:'tf',prompt:'Китайский Новый год каждый год приходится на 1 января.',options:['Правда','Ложь'],correct:1},
    {kind:'choice',prompt:'Как называют новогоднее празднование в Шотландии?',options:['Хогманай','Сатурналии','Томатина'],correct:0},
    {kind:'tf',prompt:'В Испании двенадцать виноградин связывают с двенадцатью удачными месяцами нового года.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Какой календарь стал основой для даты 1 января в большинстве стран?',options:['Григорианский','Лунный','Еврейский'],correct:0},
    {kind:'tf',prompt:'В Бразилии Новый год встречают летом.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Что в некоторых районах Эквадора сжигают в новогоднюю ночь как символ уходящего года?',options:['Фигуры-«старые годы»','Бумажные фонари','Ёлочные игрушки'],correct:0},
    {kind:'choice',prompt:'Сколько ударов колокола по традиции отсчитывают в некоторых японских буддийских храмах в новогоднюю ночь?',options:['108','12','24'],correct:0},
    {kind:'tf',prompt:'Во всех странах у новогоднего волшебника обязательно красная одежда.',options:['Правда','Ложь'],correct:1},
    {kind:'choice',prompt:'В каком месяце проходит китайский Новый год по традиционному календарю?',options:['В январе или феврале','Всегда в марте','Всегда в декабре'],correct:0},
    {kind:'tf',prompt:'Старый Новый год в России связан с разницей между юлианским и григорианским календарями.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Что чаще всего украшает верхушку новогодней ёлки?',options:['Звезда','Ключ','Колокольчик для двери'],correct:0},
    {kind:'tf',prompt:'В Южном полушарии январь приходится на лето.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Что символически желают, когда в Греции находят монетку в праздничном пироге?',options:['Удачи','Скорой зимы','Хорошей погоды'],correct:0},
    {kind:'tf',prompt:'В високосном году в феврале 29 дней.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'В каком городе проходит знаменитый новогодний спуск шара на Таймс-сквер?',options:['В Нью-Йорке','В Лондоне','В Торонто'],correct:0},
    {kind:'tf',prompt:'В григорианском календаре високосный год обычно длится 366 дней.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Как называется традиционное жареное угощение, которое едят в Нидерландах в новогодний период?',options:['Олиболлен','Василопита','Тосикоси-соба'],correct:0},
    {kind:'tf',prompt:'В Шотландии существует обычай «первого гостя»: кто первым переступит порог после полуночи, тому приписывают особое значение.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Какой предмет некоторые жители Колумбии берут с собой на прогулку, желая чаще путешествовать в новом году?',options:['Пустой чемодан','Зонт','Подушку'],correct:0},
    {kind:'tf',prompt:'В некоторых новогодних традициях Филиппин круглые фрукты связывают с достатком и монетами.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'С чем в Италии часто связывают чечевицу на новогоднем столе?',options:['С достатком и монетами','С долгой дорогой','С началом весны'],correct:0},
    {kind:'tf',prompt:'Новый год наступает одновременно во всех странах мира.',options:['Правда','Ложь'],correct:1},
    {kind:'choice',prompt:'Какой календарь был введён при папе Григории XIII и сегодня используется во многих странах?',options:['Григорианский','Юлианский','Майя'],correct:0},
    {kind:'tf',prompt:'Григорианская календарная реформа была провозглашена в XVI веке.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Какой месяц, согласно указу Петра I, стал первым месяцем года в России с 1700 года?',options:['Январь','Сентябрь','Март'],correct:0},
    {kind:'tf',prompt:'До реформы Петра I начало года в России приходилось на 1 сентября.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Как называется шотландская традиция новогоднего празднования?',options:['Хогманай','Карнавалия','Сатурналии'],correct:0},
    {kind:'tf',prompt:'В Эфиопии Новый год обычно отмечают в сентябре, а не 1 января.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Что в некоторых греческих семьях разбивают у порога в первый день года как символ обновления и удачи?',options:['Гранат','Тыкву','Глиняный горшок с водой'],correct:0},
    {kind:'tf',prompt:'В Испании принято съедать по одной виноградине под каждый из двенадцати ударов полуночного часа.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Какой шотландский поэт связан с известной песней «Auld Lang Syne», которую часто поют в новогоднюю ночь?',options:['Роберт Бёрнс','Уильям Шекспир','Вальтер Скотт'],correct:0},
    {kind:'tf',prompt:'В Южном полушарии январь обычно приходится на летний сезон.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Какой день в современном календаре в России обычно называют Старым Новым годом?',options:['14 января','7 января','19 января'],correct:0},
    {kind:'tf',prompt:'Старый Новый год связан с тем, что 1 января по юлианскому календарю сейчас приходится на 14 января по григорианскому.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Как называют римское божество, в честь которого получил имя январь?',options:['Янус','Юпитер','Меркурий'],correct:0},
    {kind:'tf',prompt:'В григорианском календаре годы, кратные 100, не считаются високосными, если они не делятся на 400.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Какое число месяцев в обычном григорианском году?',options:['12','10','13'],correct:0},
    {kind:'tf',prompt:'Китайский Новый год каждый год начинается в один и тот же день григорианского календаря.',options:['Правда','Ложь'],correct:1},
    {kind:'choice',prompt:'Как называется длинная японская лапша, которую едят накануне Нового года?',options:['Тосикоси-соба','Олиболлен','Василопита'],correct:0},
    {kind:'tf',prompt:'Обычай есть тосикоси-соба в Японии связывают с пожеланием долгой жизни.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Сколько дней в обычном году по григорианскому календарю?',options:['365','360','366'],correct:0},
    {kind:'tf',prompt:'В новогоднюю ночь во многих японских буддийских храмах звонят в колокол 108 раз.',options:['Правда','Ложь'],correct:0},
    {kind:'choice',prompt:'Какой остров Кирибати относится к числу первых населённых мест, где наступает Новый год?',options:['Киритимати','Мадагаскар','Бали'],correct:0},
    {kind:'tf',prompt:'Обычный год по григорианскому календарю состоит из 365 дней.',options:['Правда','Ложь'],correct:0}
  ];
  const memoFacts = [
    'В испанской традиции под бой часов съедают 12 виноградин — по одной на каждый месяц года.',
    'Январь получил имя от Януса, римского божества дверей и начал: он смотрел и назад, и вперёд.',
    'Дата китайского Нового года меняется, потому что праздник рассчитывают по традиционному календарю.',
    'В некоторых японских храмах в новогоднюю ночь звучит 108 ударов колокола.',
    'По указу Петра I Новый год в России стали отмечать 1 января; впервые — в 1700 году.',
    'Старый Новый год отмечают из-за разницы между юлианским и григорианским календарями.',
    'В Шотландии новогодние празднования называют Хогманай.',
    'В Бразилии январь приходится на лето — страна находится в Южном полушарии.',
    'В Греции к Новому году пекут василопиту; в одном из кусочков прячут монетку на удачу.',
    'Японская тосикоси-соба — длинная лапша, которую едят накануне Нового года.',
    'В некоторых районах Эквадора фигурки, символизирующие старый год, сжигают в полночь.',
    'Китайский Новый год может наступить в январе или феврале — фиксированной даты в григорианском календаре у него нет.',
    'Обычай украшать рождественскую ёлку широко распространился в Европе из немецких земель.',
    'В Южном полушарии новогодний январь — летний месяц.',
    'Праздник Хогманай в Шотландии включает особые местные обычаи встречи нового года.',
    'В Испании двенадцать виноградин часто связывают с пожеланием удачи на двенадцать месяцев.',
    'Високосный год добавляет к февралю один день — 29 февраля.',
    'Во многих странах Новый год наступает 1 января по григорианскому календарю, но не во всех культурах.',
    'Фейерверки и пороховые праздничные хлопушки имеют давнюю историю в Китае.',
    'Василопита — греческий праздничный пирог, который часто разрезают в начале года.',
    'Календарь помогает отсчитывать дни до праздника, а гирлянда — огоньки на ёлке.',
    'Традиция есть тосикоси-соба в Японии связана с пожеланием долгой жизни.',
    'В некоторых странах в полночь шумят и запускают огни, чтобы отметить переход к новому году.',
    'В России календарь официально перешёл на григорианское летоисчисление в 1918 году.',
    'В разных странах Новый год встречают по-разному: с виноградом, пирогом, колоколами или семейным ужином.',
    'Традиционный спуск шара на Таймс-сквер в Нью-Йорке стал одним из самых известных телевизионных новогодних событий.',
    'Олиболлен — круглые жареные пончики, которые в Нидерландах особенно популярны в канун Нового года.',
    'В шотландском обычае first-footing важен первый человек, который входит в дом после полуночи.',
    'В Италии чечевицу на новогоднем столе часто считают символом монет и будущего достатка.',
    'В некоторых районах Колумбии люди обходят квартал с пустым чемоданом, желая себе путешествий.',
    'На Филиппинах круглые фрукты на праздничном столе могут символизировать монеты и процветание.',
    'Григорианский календарь назван в честь папы римского Григория XIII и был введён в 1582 году.',
    'В григорианском календаре правило високосного года учитывает столетия: год, кратный 100, обычно пропускает високосный день, кроме годов, кратных 400.',
    'В Эфиопии Новый год, Энкутаташ, обычно отмечают в сентябре.',
    'В Шотландии новогодние торжества известны как Хогманай; у праздника есть местные обычаи встречи гостей.',
    'Песня «Auld Lang Syne» тесно связана с шотландской традицией и часто звучит в новогоднюю ночь.',
    'В некоторых греческих семьях гранат разбивают у входа в дом как пожелание удачи и изобилия.',
    'В Нидерландах к новогоднему периоду готовят олиболлен — небольшие жареные шарики из теста.',
    'На Таймс-сквер в Нью-Йорке новогоднюю полночь отмечают спуском большого светящегося шара.',
    'Старый Новый год приходится на 14 января по современному гражданскому календарю из-за разницы календарных систем.',
    'По указу Петра I начало года в России перенесли на 1 января; первое празднование по новому порядку прошло в 1700 году.',
    'До реформы Петра I год в России начинался 1 сентября.',
    'Янус в древнеримской мифологии был связан с дверями, переходами и началами; его часто изображали с двумя лицами.',
    'Новый год приходит в разные часовые пояса по очереди, поэтому полночь наступает не одновременно на всей планете.',
    'Китайский календарь — лунно-солнечный, поэтому дата праздника меняется относительно григорианского календаря.',
    'В южном полушарии декабрь, январь и февраль приходятся на лето.',
    'Обычный год в григорианском календаре содержит 365 дней, а високосный — 366.',
    'Римский Новый год в древности был связан с январскими календами, а название месяца сохранило память о Янусе.',
    'В Испании двенадцать виноградин едят под бой часов, загадывая удачу на двенадцать месяцев.',
    'В Японии длинную лапшу тосикоси-соба едят накануне Нового года как пожелание долгой жизни.',
    'Во многих японских буддийских храмах в канун Нового года звучит 108 ударов колокола.',
    'В некоторых странах новогодние фейерверки стали способом громко отметить переход к новому календарному году.',
    'Новый год по григорианскому календарю начинается 1 января, но разные культуры отмечают начало года и в другие даты.',
    'Високосные годы помогают календарю оставаться согласованным с продолжительностью обращения Земли вокруг Солнца.'
  ];

  const guessDeck = [
    ['Снегурочка','👸🏻'],['Снеговик','⛄'],['Ёлка','🎄'],['Олень','🦌'],['Мандарин','🍊'],
    ['Снежинка','❄️'],['Подарок','🎁'],['Дед Мороз','🎅🏻'],['Варежки','🧤'],['Сани','🛷'],
    ['Снегирь','🐦'],['Ёлочный шар','🔴'],['Сосулька','🧊'],['Белый медведь','🐻‍❄️'],['Щелкунчик','🪆'],
    ['Колокольчик','🔔'],['Пряничный человечек','🍪'],['Пингвин','🐧'],['Снежный шар','🔮'],['Гирлянда','💡'],
    ['Заяц','🐇'],['Коньки','⛸️'],['Лыжник','🎿'],['Северное сияние','🌌'],['Какао','☕'],
    ['Хлопушка','🎉'],['Носок у камина','🧦'],['Салат оливье','🥗'],['Тёплый шарф','🧣'],['Сосновая шишка','🌰'],
    ['Фонарик','🏮'],['Сова','🦉'],['Рождественская звезда','🌟'],['Морозный узор','❄️'],['Имбирное печенье','🍪'],
    ['Подарочная лента','🎀'],['Валенки','🥾'],['Шапка','🧢'],['Письмо Деду Морозу','✉️'],['Иней','❄️'],
    ['Мишура','✨'],['Ёлочная игрушка','🔴'],['Хоровод','💃'],['Мороз','🥶'],['Календарь','📆']
  ].map(([name, emoji], design) => ({ name, emoji, design:design%6, image:aiCardArt[name] || '' }));

  const promptsSimple = [
    // Персонажи и животные
    ['Дед Мороз','🎅🏻'],['Снегурочка','👸🏻'],['Снеговик','⛄'],['Северный олень','🦌'],['Снегирь','🐦'],
    ['Заяц','🐇'],['Белый медведь','🐻‍❄️'],['Пингвин','🐧'],['Лиса','🦊'],['Белка','🐿️'],
    ['Сова','🦉'],['Волк','🐺'],['Щелкунчик','🪆'],['Пряничный человечек','🍪'],['Лесной гном','🧝'],
    ['Снежная королева','👑'],['Ангел','👼'],['Кот у ёлки','🐈'],['Лошадка-качалка','🧸'],['Чудеса','✨'],
    // Украшения и подарки
    ['Ёлка','🎄'],['Ёлочная игрушка','🔴'],['Ёлочный шар','🔴'],['Звезда на ёлке','⭐'],['Гирлянда','💡'],
    ['Мишура','✨'],['Хлопушка','🎉'],['Бенгальские огни','✨'],['Фейерверк','🎆'],['Рождественский венок','🌿'],
    ['Колокольчик','🔔'],['Свеча','🕯️'],['Подсвечник','🕯️'],['Снежный шар','🔮'],['Фонарик','🏮'],
    ['Открытка','💌'],['Подарочная коробка','📦'],['Подарочная лента','🎀'],['Подарок','🎁'],['Календарь','📆'],
    // Угощения
    ['Мандарин','🍊'],['Салат оливье','🥗'],['Какао','☕'],['Горячий чай','🍵'],['Самовар','🫖'],
    ['Чайник','🫖'],['Имбирное печенье','🍪'],['Пряник','🍪'],['Пряничный домик','🏠'],['Леденец-трость','🍭'],
    ['Конфеты','🍬'],['Варенье','🫙'],['Торт','🍰'],['Яблоки','🍎'],['Орехи','🌰'],
    ['Мёд','🍯'],['Корица','🪵'],['Мармелад','🍬'],['Пирог','🥧'],['Сухофрукты','🍇'],
    // Одежда и зимние забавы
    ['Сани','🛷'],['Коньки','⛸️'],['Лыжи','🎿'],['Снегокат','🛷'],['Ледянка','🛷'],
    ['Каток','⛸️'],['Горка','🛝'],['Валенки','🥾'],['Варежки','🧤'],['Шапка','🧢'],
    ['Шарф','🧣'],['Пуховик','🧥'],['Зимний сапог','🥾'],['Ушанка','🧢'],['Плед','🧶'],
    ['Снегоступы','🥾'],['Снежки','⚪'],['Снежный ком','⚪'],['Снежный ангел','👼'],['Хоровод','💃'],
    // Зима и природа
    ['Снежинка','❄️'],['Снегопад','🌨️'],['Сугроб','☃️'],['Метель','🌨️'],['Иней','❄️'],
    ['Мороз','🥶'],['Сосулька','🧊'],['Лёд','🧊'],['Северное сияние','🌌'],['Полярная звезда','🌟'],
    ['Зимний лес','🌲'],['Снежная поляна','🏔️'],['Следы на снегу','🐾'],['Замёрзшее озеро','🧊'],['Морозный узор','❄️'],
    ['Ледяной фонарь','🏮'],['Северный полюс','🧭'],['Сосновая шишка','🌰'],['Камин','🔥'],['Снежная туча','☁️']
  ].map(([word, emoji], i) => ({ word, emoji, category: ['Персонажи и животные','Украшения и подарки','Угощения','Одежда и зимние забавы','Зима и природа'][Math.floor(i / 20)] }));
  const promptsHard = [
    ['Ёлка','🎄'],['Дед Мороз','🎅🏻'],['Снегурочка','👸🏻'],['Снеговик','⛄'],['Северный олень','🦌'],['Снежинка','❄️'],['Подарок под ёлкой','🎁'],['Мандарин','🍊'],['Варежки','🧤'],['Санки','🛷'],
    ['Кататься на коньках','⛸️'],['Лепить снеговика','☃️'],['Играть в снежки','❄️'],['Наряжать ёлку','🎄'],['Загадывать желание','🌠'],['Открывать подарок','🎁'],['Петь у ёлки','🎵'],['Танцевать хоровод','💃'],['Пить горячее какао','☕'],['Печь пряники','🍪'],
    ['Снегирь на ветке','🐦'],['Белый медведь','🐻‍❄️'],['Пингвин на льдине','🐧'],['Заяц в сугробе','🐇'],['Лиса зимой','🦊'],['Сова в лесу','🦉'],['Щелкунчик','🪆'],['Пряничный человечек','🍪'],['Лесной гном','🧝'],['Снежная королева','👑'],
    ['Сосулька на крыше','🧊'],['Северное сияние','🌌'],['Метель за окном','🌨️'],['Скрипучий снег','❄️'],['Замёрзшее озеро','🧊'],['Смешивать салат оливье','🥗'],['Зимний лес','🌲'],['Полярная звезда','🌟'],['Снежная крепость','🏰'],['Следы на снегу','🐾'],
    ['Завязывать шарф','🧣'],['Надевать коньки','⛸️'],['Скользить на лыжах','🎿'],['Ехать на снегокате','🛷'],['Стряхивать снег с шапки','🧢'],['Отогревать ладони','👐'],['Чистить мандарин','🍊'],['Зажигать бенгальский огонь','✨'],['Звонить в колокольчик','🔔'],['Заворачивать подарок','🎀'],
    ['Рождественский венок','🌿'],['Адвент-календарь','📅'],['Свеча на окне','🕯️'],['Рождественская звезда','⭐'],['Ангел на ёлке','👼'],['Письмо Деду Морозу','✉️'],['Праздничный носок','🧦'],['Имбирный домик','🏠'],['Семейный ужин','🍽️'],['Новогодний фейерверк','🎆'],
    ['Подарочная коробка','📦'],['Хлопушка с конфетти','🎉'],['Ёлочный шар','🔴'],['Гирлянда огоньков','💡'],['Мишура','✨'],['Леденец-посох','🍭'],['Снежный шар','🔮'],['Музыкальная шкатулка','🎶'],['Камин и чулок','🔥'],['Рождественская открытка','💌'],
    ['Морозное дыхание','🥶'],['Снежный ангел','👼'],['Потерянная варежка','🧤'],['Ветер качает ёлку','🌬️'],['Олень в упряжке','🦌'],['Дед Мороз в дымоходе','🎅🏻'],['Пингвин катается','🐧'],['Медведь ложится спать','🐻'],['Белка прячет орешки','🐿️'],['Кот играет с мишурой','🐈'],
    ['Хоровод вокруг ёлки','🎄'],['Снежная карусель','🎠'],['Снежки летят в цель','🎯'],['Катание с ледяной горки','🛷'],['Прогулка в метель','🌨️'],['Поиск подарка','🔍'],['Упаковка сюрприза','🎁'],['Сборка снеговика','⛄'],['Сушка мокрых варежек','🧤'],['Зимний пикник','🧺'],
    ['Тёплый плед','🧶'],['Запах хвои','🌲'],['Морозный узор на окне','❄️'],['Колокольный звон','🔔'],['Искры бенгальского огня','✨'],['Тихая рождественская ночь','🌙'],['Снежная поляна','🏔️'],['Резной ледяной фонарь','🏮'],['Сани с подарками','🛷'],['Новогоднее чудо','✨']
  ].map(([word, emoji], i) => ({ word, emoji, category: ['Сказочные герои','Зимние забавы','Праздничные предметы','Животные','Зимняя природа'][Math.floor(i / 20)] }));

  const pawnChoices = ['🎅🏻','🦌','⛄','🎄','🧝','🐧','🐻‍❄️','🎁','🍊','🧤','🛷','🔔'];
  const crocPawnChoices = [
    {id:'blue',name:'Синяя',color:'#2586cc'}, {id:'violet',name:'Фиолетовая',color:'#8c55ab'},
    {id:'orange',name:'Оранжевая',color:'#f18b24'}, {id:'red',name:'Красная',color:'#df4436'},
    {id:'yellow',name:'Жёлтая',color:'#edc52c'}, {id:'green',name:'Зелёная',color:'#47a85f'}
  ];

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function notify(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.remove('show'), 2400); }
  function shuffle(items) { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function randomOther(length, previous) { let next = previous; while (next === previous) next = Math.floor(Math.random() * length); return next; }
  function fmtTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; }
  function sendSync(message) { pendingState = message; if (syncSocket?.readyState === WebSocket.OPEN) syncSocket.send(JSON.stringify(message)); }
  function connectSync() {
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    syncSocket = onlineSync ? new window.StaticSync(roomCode,'host') : new WebSocket(`${scheme}//${location.host}/sync`);
    syncSocket.addEventListener('open', () => { syncAvailable=true; syncSocket.send(JSON.stringify({type:'join', room:roomCode, role:'host'})); if (pendingState) syncSocket.send(JSON.stringify(pendingState)); });
    syncSocket.addEventListener('message', event => {
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'presence') {
        screenCount = data.count || 0; connectedPlayers = Array.isArray(data.players) ? data.players : []; updateScreenStatus();
        if (content.classList.contains('guess-screen') && guessState?.playMode === 'circle') syncCirclePlayers(connectedPlayers);
        if (fieldState?.phase==='setup' && $('#gameBody') && content.classList.contains('field-screen')) { fieldState.setupIds=fieldState.setupIds.map(id=>id && !connectedPlayers.some(p=>p.id===id)?'':id); renderField(); }
      }
      if (data.type === 'joined') { screenCount = data.screenCount || 0; updateScreenStatus(); }
      if (data.type === 'player-action' && fieldState && content.classList.contains('field-screen')) fieldRemote(data);
      if (data.type === 'player-action' && content.classList.contains('guess-screen') && guessState?.playMode === 'circle' && data.playerId === guessState.activePlayerId) circleAnswer(data.action === 'solved');
    });
    syncSocket.addEventListener('close', () => { syncAvailable=false;updateScreenStatus(false);setTimeout(connectSync,1500); });
    syncSocket.addEventListener('error', () => syncSocket.close());
  }
  function publish(state) { sendSync({type:'state', room:roomCode, payload:state}); }
  function updateScreenStatus(connected = true) { const status=$('#syncStatus');if(!status)return;const unavailable=!syncAvailable||!connected;const message=unavailable?(onlineSync?'Нет связи · проверьте интернет':'Нет связи'):screenCount?'Экран подключён':'Экран не подключён';status.innerHTML=`${unavailable?'○':'●'} ${message}`;status.classList.toggle('is-online',screenCount>0&&!unavailable); }
  function screenToolbar() { return `<div class="screen-tools"><span class="sync-status" id="syncStatus">● Подключаемся…</span><button class="soft-button" id="openDisplay">Подключить экран</button><button class="soft-button" id="copyDisplay">Скопировать ссылку</button><button class="soft-button" id="showScreenQr">QR экрана</button><div id="screenQrPanel" class="screen-qr-panel" hidden><img id="screenQrImage" alt="QR-код для экрана"><span>Отсканируйте, чтобы открыть экран</span></div><span class="screen-instruction">Откройте ссылку на проекторе или втором устройстве</span></div>`; }
  function bindScreenTools() {
    updateScreenStatus();
    $('#openDisplay')?.addEventListener('click', () => { const win = window.open(displayUrl, 'winter-game-screen'); if (!win) notify('Разрешите всплывающее окно или откройте ссылку на экране.'); });
    $('#showScreenQr')?.addEventListener('click', () => { const panel=$('#screenQrPanel'); if(panel.hidden) { try { $('#screenQrImage').src=window.makeInviteQr(displayUrl); panel.hidden=false; } catch { notify('QR-код недоступен, используйте ссылку.'); } } else panel.hidden=true; });
    $('#copyDisplay')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(displayUrl); notify(`Ссылка скопирована · код ${roomCode}`); } catch { prompt('Скопируйте ссылку для экрана участников:', displayUrl); } });
    $('#goFullscreen')?.addEventListener('click', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); });
  }
  function publishMemo() {
    if (!memoryState) return;
    const s = memoryState;
    const pending=s.pendingEvent;
    const event=pending?.type==='question'
      ? {type:'question',prompt:pending.item.prompt,options:pending.item.options,answered:Boolean(pending.answered),chosenOption:pending.answered?pending.chosen:null,correctAnswer:pending.answered?pending.item.options[pending.item.correct]:'',wasCorrect:pending.answered?Boolean(pending.wasCorrect):null,bonus:pending.bonus}
      : pending?.type==='fact'?{type:'fact',text:pending.item}:null;
    publish({game:'memo',title:'Мемо: Новый год',modeLabel:s.mode === 'teams' ? 'КОМАНДЫ' : 'ЛИЧНЫЙ ЗАЧЁТ',scoreline:`Ходы: ${s.moves} · На очереди: ${s.names[s.active]}`,deckId:s.deckId,deckLabel:s.deckId==='photo'?'НОВОГОДНЯЯ ФОТОКОЛЛЕКЦИЯ':'СНЕЖНЫЕ ИЛЛЮСТРАЦИИ',extraMode:s.extraMode,event,tiles:s.deck.map((c,i)=>({emoji:c.emoji,image:c.image,name:c.name,variant:c.design,open:s.opened.includes(i),matched:s.matched.includes(i)}))});
  }
  function contestMarkup(state) {
    const isCroc=state===crocState, choices=isCroc?crocPawnChoices:pawnChoices;
    return `<div class="contest-setup"><label>Режим<select id="contestMode"><option value="teams" ${state.mode==='teams'?'selected':''}>Командный</option><option value="solo" ${state.mode==='solo'?'selected':''}>Личный зачёт</option></select></label><label>${state.mode==='teams'?'Команды':'Игроки'}<select id="contestCount">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${state.names.length===n?'selected':''}>${n}</option>`).join('')}</select></label></div>
      <div class="score-strip">${state.names.map((name,i)=>{const pawn=isCroc?crocPawnChoices.find(p=>p.id===state.pawns[i])||crocPawnChoices[0]:null;return `<label class="score-chip ${i===state.active?'active':''}">${isCroc?`<button type="button" class="pawn-preview croc-pawn-cycle" data-pawn-cycle="${i}" style="--pawn-color:${pawn.color}" aria-label="Фишка ${pawn.name}; нажмите, чтобы сменить" title="Фишка ${pawn.name} · нажмите, чтобы сменить"><i class="croc-pawn-token" style="--pawn-color:${pawn.color}">♟</i></button>`:`<span class="pawn-preview">${state.pawns[i]}</span>`}<input class="player-name" data-name="${i}" value="${escapeHtml(name)}" maxlength="16" aria-label="Название ${state.mode==='teams'?'команды':'игрока'} ${i+1}">${isCroc?'':`<select class="pawn-choice" data-pawn="${i}" aria-label="Фишка ${i+1}">${choices.map(p=>`<option value="${p}" ${state.pawns[i]===p?'selected':''}>${p}</option>`).join('')}</select>`}<b title="${isCroc?'Позиция на дорожке':'Очки'}">${isCroc?`${state.track?.[i]||0}/29`:state.scores[i] ?? 0}</b></label>`}).join('')}</div>`;
  }
  function createContest(mode='solo', count=1) { return {mode, names:Array.from({length:count},(_,i)=>mode==='teams'?`Команда ${i+1}`:`Игрок ${i+1}`), scores:Array(count).fill(0), pawns:Array.from({length:count},(_,i)=>pawnChoices[i%pawnChoices.length]), active:0}; }
  function bindContest(state, rerender) {
    $('#contestMode')?.addEventListener('change', e => { state.mode = e.target.value; const count=Number($('#contestCount')?.value || 1); Object.assign(state, createContest(state.mode,count)); if(state===crocState){state.pawns=state.names.map((_,i)=>crocPawnChoices[i%6].id);state.track=Array(count).fill(0);state.active=Math.floor(Math.random()*count);state.roundBlocked={};state.turnsInRound=0;} rerender(); });
    $('#contestCount')?.addEventListener('change', e => { const next = createContest(state.mode,Number(e.target.value)); state.names=next.names; state.scores=next.scores; state.pawns=state===crocState?state.names.map((_,i)=>crocPawnChoices[i%6].id):next.pawns; state.active=0; if(state===crocState){state.track=Array(state.names.length).fill(0);state.active=Math.floor(Math.random()*state.names.length);state.roundBlocked={};state.turnsInRound=0;} rerender(); });
    document.querySelectorAll('.player-name').forEach(input => input.addEventListener('input', () => { state.names[Number(input.dataset.name)] = input.value; if (state===memoryState) publishMemo(); else if (state===quizState) publishQuiz(); else if (state===guessState) publishGuess(state.screenVisible); }));
    document.querySelectorAll('.pawn-choice').forEach(input => input.addEventListener('change', () => { state.pawns[Number(input.dataset.pawn)] = input.value; if (state===crocState) renderCroc(); else if (state===memoryState) publishMemo(); else if (state===quizState) publishQuiz(); else if (state===guessState) publishGuess(state.screenVisible); }));
    document.querySelectorAll('.croc-pawn-cycle').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.pawnCycle),current=crocPawnChoices.findIndex(p=>p.id===state.pawns[index]);state.pawns[index]=crocPawnChoices[(current+1+crocPawnChoices.length)%crocPawnChoices.length].id;renderCroc();}));
  }
  // Separate versioned saves for the two host-operated games. No audio blobs are stored.
  const savedGamesInMemory={};
  const saveKey=game=>`snowy-host-${game}-v1`;
  function writeGameSave(game,state) {
    const value=JSON.stringify({version:1,state});savedGamesInMemory[game]=value;
    try {localStorage.setItem(saveKey(game),value);return true;} catch {return false;}
  }
  function readGameSave(game) {
    try {
      const saved=JSON.parse(savedGamesInMemory[game] || localStorage.getItem(saveKey(game)) || 'null');
      const s=saved?.state;
      if(saved?.version!==1 || !s || typeof s!=='object')return null;
      if(game==='field') {
        if(!['setup','spin','spinning','letter','plus','prize','chest','solveOnly','superLetters','superSolve','over'].includes(s.phase) || !Number.isInteger(s.round) || s.round<1 || s.round>4 || !Array.isArray(s.queue) || !Array.isArray(s.players) || !Array.isArray(s.winners) || !Array.isArray(s.guessed) || !Array.isArray(s.setupNames) || !Array.isArray(s.setupIds) || (s.phase!=='setup' && (!s.question || typeof s.question.answer!=='string' || typeof s.question.question!=='string' || !s.players[s.active])))return null;
        if(s.queue.some(i=>!Number.isInteger(i)||i<0||i>=window.FIELD_QUESTIONS.length) || !Number.isInteger(s.count) || s.count<1 || s.count>3 || !Number.isInteger(s.active) || !Number.isFinite(s.angle) || !Number.isFinite(s.seconds) || typeof s.message!=='string' || s.players.some(p=>!p || typeof p.name!=='string' || !Number.isFinite(p.score)) || s.winners.some(p=>!p || typeof p.name!=='string') || s.guessed.some(x=>typeof x!=='string'))return null;
      } else {
        const index=(n,max)=>Number.isInteger(n)&&n>=0&&n<max;
        if(!['russian','international','mixed','children'].includes(s.version) || !Number.isInteger(s.tour) || !index(s.tour-1,5) || !Array.isArray(s.names) || s.names.length!==3 || s.names.some(n=>typeof n!=='string') || !Array.isArray(s.scores) || s.scores.length!==3 || s.scores.some(n=>!Number.isFinite(n)) || !Array.isArray(s.used) || s.used.length!==3 || s.used.some(a=>!Array.isArray(a)||a.some(n=>!index(n,20))) || (s.selected!==null&&!index(s.selected,20)) || !s.judged || typeof s.judged!=='object')return null;
        const a=s.auction,supergame=s.super;
        if(!a || !['setup','bidding','guess','result','finished'].includes(a.phase) || !Array.isArray(a.players) || a.players.length!==2 || a.players.some(n=>!index(n,3)) || !Array.isArray(a.points) || a.points.length!==2 || a.points.some(n=>!Number.isFinite(n)) || !index(a.track,5) || !index(a.turn,2) || (a.bidder!==null&&!index(a.bidder,2)) || (a.lastWinner!==null&&!index(a.lastWinner,2)))return null;
        if(!supergame || !['ready','paused','won','lost'].includes(supergame.status) || !Number.isFinite(supergame.seconds) || supergame.seconds<0 || !index(supergame.player,3) || !Array.isArray(supergame.queue) || supergame.queue.some(n=>!index(n,7)) || (supergame.status==='paused'&&!supergame.queue.length))return null;
      }
      return s;
    } catch {return null;}
  }
  function saveField() {
    if(!fieldState)return false;
    const s={...fieldState};
    if(s.phase==='spinning'){s.phase='spin';s.sector=null;s.message='Вращение прервано. Крутите барабан ещё раз.';}
    if(s.phase==='superSolve')s.seconds=Math.max(0,Math.ceil((s.deadline-Date.now())/1000));
    return writeGameSave('field',s);
  }
  function saveMelody() {
    if(!melodyState)return false;
    const s={...melodyState,files:{},cues:{},super:{...melodyState.super}};
    if(s.super.status==='running') {s.super.seconds=superRemaining(melodyState);s.super.status=s.super.seconds?'paused':'lost';s.super.deadline=0;}
    return writeGameSave('melody',s);
  }
  function saveOpenGames(){if(fieldState)saveField();if(melodyState)saveMelody();}
  window.addEventListener('pagehide',saveOpenGames);
  function saveStatus(ok) {return ok?'Прогресс сохраняется в этом браузере':'Сохранение недоступно: прогресс только до закрытия вкладки';}
  function chooseSavedGame(game,start) {
    const saved=readGameSave(game);
    if(!saved){start(null);return;}
    const body=$('#gameBody'),reset=$('#resetCurrentGame');if(reset)reset.hidden=true;
    const begin=s=>{if(reset)reset.hidden=false;start(s);};
    body.innerHTML=`<section class="game-resume"><span>✦ ИГРА СОХРАНЕНА</span><h2>Продолжить игру?</h2><p>На этом устройстве найдена сохранённая игра. Продолжите с прежнего места или начните заново.</p>${game==='field'?'<p>После обновления страницы телефоны и экран нужно подключить заново, телефоны — также назначить игрокам. Если барабан вращался, его нужно крутить ещё раз.</p>':'<p>Свои загруженные аудиофайлы нужно выбрать заново. Встроенные мелодии останутся доступны.</p>'}<div><button id="resumeGame" type="button">▶ Продолжить игру</button><button id="newSavedGame" type="button">Начать заново</button></div></section>`;
    $('#resumeGame').addEventListener('click',()=>begin(saved));
    $('#newSavedGame').addEventListener('click',()=>{if(confirm('Начать заново и удалить сохранённый прогресс этой игры?'))begin(null);});
    publish({game:'idle',revealed:false,instruction:'Ведущий выбирает сохранённую игру.'});
  }
  function resetCurrentGame() {
    if(!fieldState&&!melodyState)return;
    if(!confirm('Сбросить игру? Очки, ходы и сохранённый прогресс будут удалены.'))return;
    if(fieldState){if(fieldSuperTimer){clearInterval(fieldSuperTimer);fieldSuperTimer=null;}fieldState=newFieldState();renderField();}
    else if(melodyState){const version=melodyState.version;disposeMelodyFiles();melodyState=newMelodyState(version);renderMelody();}
  }
  function commonFrame(title, kicker, description, gameClass) {
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
    content.className=`modal-content ${gameClass || ''}`;
    content.innerHTML=`<div class="game-topbar"><button class="back-game" id="backHome">← Все игры</button><div class="full-brand">❄ СНЕЖНЫЙ ПЕРЕПОЛОХ</div><button class="fullscreen-control" id="goFullscreen">На весь экран ⛶</button>${['field-screen','melody-screen'].includes(gameClass)?'<button class="game-reset" id="resetCurrentGame" type="button">Сбросить игру ↻</button>':''}</div><div class="modal-heading"><div class="section-kicker">${kicker}</div><h2 id="modalTitle">${title}</h2><p>${description}</p></div>${screenToolbar()}<div id="gameBody"></div>`;
    $('#backHome').addEventListener('click', closeGame);
    $('#resetCurrentGame')?.addEventListener('click',resetCurrentGame);
    bindScreenTools();
    return $('#gameBody');
  }
  function closeGame() { saveOpenGames(); if(fieldSuperTimer){clearInterval(fieldSuperTimer);fieldSuperTimer=null;} fieldState=null; disposeMelodyFiles(); melodyState=null; if (memoryState?.timer) clearInterval(memoryState.timer); if (crocState?.timer) clearInterval(crocState.timer); publish({game:'idle',revealed:false,instruction:'Выберите игру на главном экране.'}); modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
// --- «Поле чудес»: ведущий хранит ответ только у себя ---
let fieldState = null, fieldSuperTimer = null;
const fieldSectors = [500, 350, 'Б', 600, 400, 'П', 750, 0, 550, '×2', 450, 800, 'Ш', 300, 650, '+', 900, 'Б', 250, 700, 1000, 400, 500, 850];
const fieldAlphabet = [...'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];
const fieldNorm = value => String(value || '').toUpperCase().replace(/Ё/g,'Е').replace(/Й/g,'И').replace(/[^А-Я]/g,'');
const fieldLabel = s => s.superRound ? 'СУПЕРИГРА' : s.round === 4 ? 'ФИНАЛ' : `ТРОЙКА ${s.round} / 3`;
function newFieldState() {
  return {round:1,phase:'setup',queue:shuffle((window.FIELD_QUESTIONS||[]).map((_,i)=>i)),question:null,players:[],winners:[],active:0,guessed:[],sector:null,angle:0,streak:0,soloHits:0,message:'Подготовьте первую тройку и начните тур.',setupNames:['Игрок 1','Игрок 2','Игрок 3'],setupIds:['','',''],count:3,chestPrize:0,reaction:'',superRound:false,champion:null,seconds:60,deadline:0};
}
function fieldCurrent(s) { return s.players[s.active]; }
function fieldBoard(s) {
  if(!s.question) return [];
  return [...s.question.answer].map((ch,index)=>({index,space:ch===' ',letter:ch===' '?'':(s.phase==='over'||s.guessed.includes(fieldNorm(ch))?ch:'')}));
}
function fieldPublic(s) {
  return {game:'field',round:fieldLabel(s),phase:s.phase,question:s.question?.question||'',board:fieldBoard(s),players:s.players.map(p=>({id:p.id,name:p.name,score:p.score,out:p.out})),activeId:fieldCurrent(s)?.id||'',activeIndex:s.active,sector:s.sector==null?'':String(s.sector),angle:s.angle,message:s.message,guessed:s.guessed, reaction:s.reaction,seconds:s.superRound?s.seconds:null};
}
function fieldWheelMarkup(s) {
  const colors=['#c72c43','#225dac','#128069','#e99928','#4a4298','#bd4865','#147fa0','#643a83'];
  const step=360/fieldSectors.length;
  const stops=fieldSectors.map((_,i)=>`${colors[i%colors.length]} ${i*step}deg ${(i+1)*step}deg`).join(',');
  return `<div class="field-wheel-wrap"><div class="field-pointer" aria-hidden="true"></div><div class="field-wheel-art" id="fieldWheelArt" style="background:conic-gradient(${stops});transform:rotate(${s.angle}deg)">${fieldSectors.map((sector,i)=>`<span style="--a:${i*step+step/2}deg"><b>${sector}</b></span>`).join('')}<div class="field-wheel-hub">❄<small>ПОЛЕ<br>ЧУДЕС</small></div></div></div>`;
}
function fieldSetup(s) {
  const final=s.round===4;
  if(final && !s.winners.length) return `<div class="field-setup"><h3>Финал не состоялся</h3><p>Ни одна из троек не определила победителя.</p><button id="fieldRestart">Новая игра</button></div>`;
  const rows=final?s.winners.map(p=>`<div class="field-finalist">✦ ${escapeHtml(p.name)}</div>`).join(''):Array.from({length:s.count},(_,i)=>`<div class="field-seat"><label>Участник ${i+1}<input data-field-name="${i}" maxlength="24" value="${escapeHtml(s.setupNames[i])}" ${s.setupIds[i]?'disabled':''}></label><label>Телефон<select data-field-seat="${i}"><option value="">Игра с экрана</option>${connectedPlayers.map(p=>`<option value="${escapeHtml(p.id)}" ${s.setupIds[i]===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select></label></div>`).join('');
  return `<div class="field-setup"><span class="field-eyebrow">${fieldLabel(s)} · НАСТРОЙКА</span><h3>${final?'Финалисты':'Пригласите участников'}</h3><p>${final?'Победители троек разыгрывают финал.':'Назначьте от одного до трёх человек: за общим экраном или с подключённого телефона.'}</p>${final?'':`<label class="field-count">Число участников <select id="fieldCount">${[1,2,3].map(n=>`<option ${n===s.count?'selected':''}>${n}</option>`).join('')}</select></label>`}${rows}<button id="fieldStart">Начать ${final?'финал':'тур'} →</button></div>`;
}
function fieldControls(s) {
  const inPlay=!['setup','over','spinning'].includes(s.phase);
  const letters=fieldAlphabet.map(ch=>`<button class="field-letter-btn" data-field-letter="${ch}" ${!['letter','superLetters'].includes(s.phase)||s.guessed.includes(ch)?'disabled':''}>${ch}</button>`).join('');
  const board=fieldBoard(s).map(tile=>tile.space?'<span class="field-word-space"></span>':`<button class="field-tile ${tile.letter?'open':''}" data-field-tile="${tile.index}" ${s.phase!=='plus'||tile.letter?'disabled':''} aria-label="Буква ${tile.index+1}${tile.letter?' открыта':''}">${escapeHtml(tile.letter)}</button>`).join('');
  return `<div class="field-game-grid"><section class="field-stage"><div class="field-stage-head"><span>${fieldLabel(s)}</span><span>❄ НОВОГОДНИЙ ВЫПУСК</span></div><h3>${escapeHtml(s.question.question)}</h3><div class="field-word-board">${board}</div><div class="field-status" role="status">${escapeHtml(s.message)}</div><div class="field-scores">${s.players.map((p,i)=>`<div class="field-score ${i===s.active&&s.phase!=='over'?'active':''} ${p.out?'out':''}"><span>${escapeHtml(p.name)}</span><b>${p.score} <small>очков</small></b>${p.out?'<em>выбыл</em>':''}</div>`).join('')}</div>${s.superRound&&s.phase==='superSolve'?`<div class="field-clock">${s.seconds} <small>секунд</small></div>`:''}${s.phase==='over'?`${s.round===4&&!s.superRound&&s.champion?'<button id="fieldSuper">Суперигра ★</button> ':''}<button id="fieldNext">${s.round<3?'Следующая тройка →':s.round===3?'К финалу →':'Новая игра ↻'}</button>`:''}</section><aside class="field-wheel-panel">${fieldWheelMarkup(s)}<div class="field-sector-label">${s.sector==null?'КРУТИТЕ БАРАБАН':`СЕКТОР · ${escapeHtml(s.sector)}`}</div><button id="fieldSpin" ${s.phase!=='spin'?'disabled':''}>Крутить барабан ↻</button></aside></div>
  <section class="field-console"><h3>Ход: ${escapeHtml(fieldCurrent(s)?.name||'—')}</h3><p>${s.phase==='superLetters'?`Назовите пять разных букв: ${s.guessed.length} / 5. Затем будет минута на ответ.`:s.phase==='superSolve'?'Назовите слово за 60 секунд.':s.phase==='letter'?'Назовите букву. Верные буквы откроются все.':s.phase==='plus'?'Выберите закрытую клетку на табло.':s.phase==='prize'?'Взять приз и выбыть или продолжить с сектором 2000.':s.phase==='chest'?'Три верные буквы подряд: выберите одну шкатулку.':s.phase==='solveOnly'?'Остался один участник: три результативных хода использованы, назовите слово.':'Крутите барабан или назовите слово целиком.'}</p><div class="field-alphabet">${letters}</div>${s.phase==='prize'?'<div class="field-actions"><button data-field-prize="take">🎁 Взять приз и выбыть</button><button data-field-prize="continue">Продолжить · 2000 за букву</button></div>':''}${s.phase==='chest'?'<div class="field-actions"><button data-field-chest="0">🎁 Шкатулка 1</button><button data-field-chest="1">🎁 Шкатулка 2</button></div>':''}<form id="fieldSolve" class="field-solve"><input id="fieldAnswer" autocomplete="off" maxlength="80" placeholder="Назвать слово целиком" ${!['spin','letter','solveOnly','superSolve'].includes(s.phase)?'disabled':''}><button ${!['spin','letter','solveOnly','superSolve'].includes(s.phase)?'disabled':''}>Назвать слово</button></form><small>${s.superRound?'Суперигра: пять букв и один ответ за минуту.':'Ошибка в слове — участник выбывает. Угаданная буква сохраняет ход; повтор и ошибка передают его.'} Ё = Е, Й = И.</small></section>`;
}
function fieldReconnect(s) {
  if(!s.players.length)return '';
  return `<details class="field-reconnect"><summary>📱 Назначить или переподключить телефоны</summary><p>Подключите игроков по QR и выберите телефон для каждого участника. Имена и очки не изменятся; без телефона можно играть с экрана.</p><div class="field-reconnect-seats">${s.players.map((p,i)=>`<label>${escapeHtml(p.name)}<select data-field-player-seat="${i}"><option value="">Игра с экрана</option>${connectedPlayers.map(q=>`<option value="${escapeHtml(q.id)}" ${q.id===p.id?'selected':''}>${escapeHtml(q.name)}</option>`).join('')}</select></label>`).join('')}</div><button type="button" id="fieldRefreshPlayers">Обновить список телефонов</button></details>`;
}
function renderField() {
  const s=fieldState, body=$('#gameBody'); if(!s||!body)return;
  const saved=saveField();
  const inviteOpen=Boolean(body.querySelector('.field-invite')?.open), seatsOpen=Boolean(body.querySelector('.field-reconnect')?.open), rulesOpen=Boolean(body.querySelector('.field-rules')?.open);
  body.innerHTML=`<div class="field-show"><header class="field-intro"><div><span>✦ ЗИМНИЙ ВЫПУСК ✦</span><h2>Поле чудес</h2><p>Три тройки · финал · ${window.FIELD_QUESTIONS.length} заданий без повторов за игру</p></div><div class="field-badge">❄</div></header><p class="game-save-status" role="status">${saveStatus(saved)} · выход из игры сохраняет прогресс</p><details class="field-invite"><summary>📱 Подключить игроков и зрителей · ${connectedPlayers.length} игроков</summary><p>Сканируйте QR на телефоне и выберите роль. Игрока назначьте на место в тройке. Можно играть только с этого экрана.</p><div class="local-join-box"><div class="local-qr-wrap"><img id="playerInviteQr" alt="QR-код входа" hidden><div id="localQrPlaceholder">❄</div></div><div class="local-join-details"><b id="localInviteTitle">Подключение</b><p id="localInviteHint">Готовим ссылку…</p><div class="circle-invite"><span id="playerInviteUrl"></span><button class="soft-button" id="copyPlayerLink">Скопировать</button></div><div class="local-room-code">КОД КОМНАТЫ <strong>${roomCode}</strong></div></div></div><small>${onlineSync?'Нужен интернет и открытая страница ведущего; качество соединения зависит от сети.':'Устройства должны быть в одной сети с ведущим.'}</small></details>${s.phase==='setup'?fieldSetup(s):fieldControls(s)+fieldReconnect(s)}<details class="field-rules"><summary>Правила и особенности адаптации</summary><p>Три отборочные тройки и финал. Верная буква открывает все совпадения и приносит очки за каждую. 0 — переход хода, Б — потеря очков и хода, + — открытие выбранной буквы, ×2 — умножение счёта при верной букве, П — приз или продолжение, Ш — помощь зрителя и 1500 за букву. Три верные буквы подряд — две шкатулки. Если остался один игрок, после трёх результативных ходов он называет слово. Призы виртуальные. Суперигра — упрощённая версия с одним словом, пятью буквами и минутой на ответ. <a href="https://homeofgames.ru/game/kapital-shou-pole-chudes" target="_blank" rel="noopener noreferrer">Правила передачи ↗</a></p></details>${s.reaction?`<div class="field-reaction">${escapeHtml(s.reaction)}</div>`:''}</div>`;
  if(inviteOpen)body.querySelector('.field-invite').open=true;
  if(seatsOpen&&body.querySelector('.field-reconnect'))body.querySelector('.field-reconnect').open=true;
  if(rulesOpen)body.querySelector('.field-rules').open=true;
  setupPlayerInvite();
  $('#copyPlayerLink')?.addEventListener('click',async()=>{const url=appPageUrl(`player.html?room=${roomCode}`);try{await navigator.clipboard.writeText(url);notify('Ссылка скопирована.');}catch{prompt('Ссылка для телефонов:',url);}});
  $('#fieldCount')?.addEventListener('change',e=>{s.count=Number(e.target.value);renderField();});
  body.querySelectorAll('[data-field-name]').forEach(input=>input.addEventListener('input',()=>{s.setupNames[+input.dataset.fieldName]=input.value;saveField();}));
  $('#fieldRefreshPlayers')?.addEventListener('click',renderField);
  body.querySelectorAll('[data-field-player-seat]').forEach(select=>select.addEventListener('change',()=>{const i=Number(select.dataset.fieldPlayerSeat),id=select.value;if(id && s.players.some((p,j)=>j!==i&&p.id===id)){notify('Этот телефон уже назначен другому игроку.');renderField();return;}s.players[i].id=id;renderField();}));
  body.querySelectorAll('[data-field-seat]').forEach(select=>select.addEventListener('change',()=>{const i=+select.dataset.fieldSeat,id=select.value;if(id && s.setupIds.some((other,j)=>j!==i&&j<s.count&&other===id)){notify('Этот телефон уже назначен на другое место.');renderField();return;}s.setupIds[i]=id;if(id)s.setupNames[i]=connectedPlayers.find(p=>p.id===id)?.name||s.setupNames[i];renderField();}));
  $('#fieldStart')?.addEventListener('click',fieldStart);
  $('#fieldRestart')?.addEventListener('click',resetCurrentGame);
  $('#fieldSpin')?.addEventListener('click',fieldSpin);
  body.querySelectorAll('[data-field-letter]').forEach(b=>b.addEventListener('click',()=>fieldLetter(b.dataset.fieldLetter)));
  body.querySelectorAll('[data-field-tile]').forEach(b=>b.addEventListener('click',()=>fieldPlus(+b.dataset.fieldTile)));
  body.querySelectorAll('[data-field-prize]').forEach(b=>b.addEventListener('click',()=>fieldPrize(b.dataset.fieldPrize)));
  body.querySelectorAll('[data-field-chest]').forEach(b=>b.addEventListener('click',()=>fieldChest(+b.dataset.fieldChest)));
  $('#fieldSolve')?.addEventListener('submit',e=>{e.preventDefault();fieldSolve($('#fieldAnswer').value);});
  $('#fieldNext')?.addEventListener('click',fieldNext);
  $('#fieldSuper')?.addEventListener('click',fieldSuperStart);
  publish(fieldPublic(s));
}
function fieldStart() {
  const s=fieldState;if(s.phase!=='setup')return;
  let players=s.round===4?s.winners.map(p=>({...p,score:0,out:false})):Array.from({length:s.count},(_,i)=>({name:s.setupNames[i].trim().slice(0,24)||`Игрок ${i+1}`,id:s.setupIds[i]||'',score:0,out:false}));
  if(!players.length)return;
  players.forEach(p=>{if(p.id&&!connectedPlayers.some(q=>q.id===p.id))p.id='';});
  if(!s.queue.length)s.queue=shuffle(window.FIELD_QUESTIONS.map((_,i)=>i));
  s.question=window.FIELD_QUESTIONS[s.queue.shift()];s.players=players;s.active=0;s.guessed=[];s.sector=null;s.streak=0;s.soloHits=0;s.phase='spin';s.message=`${players[0].name}, крутите барабан или назовите слово.`;renderField();
}
function fieldSpin() {
  const s=fieldState;if(!s||s.phase!=='spin')return;
  const index=Math.floor(Math.random()*fieldSectors.length), step=360/fieldSectors.length;
  const target=(360-(index*step+step/2))%360, current=((s.angle%360)+360)%360;
  s.angle+=360*5+((target-current+360)%360);s.sector=null;s.phase='spinning';s.message='Барабан вращается…';
  const wheel=$('#fieldWheelArt');if(wheel)wheel.style.transform=`rotate(${s.angle}deg)`;
  $('#fieldSpin').disabled=true;const status=$('.field-status');if(status)status.textContent=s.message;saveField();publish(fieldPublic(s));
  setTimeout(()=>{if(fieldState!==s||s.phase!=='spinning')return;s.sector=fieldSectors[index];
    if(s.sector==='Б'){fieldCurrent(s).score=0;fieldPass('Банкрот: очки сгорели.');}
    else if(s.sector===0)fieldPass('Ноль: переход хода.');
    else if(s.sector==='+'){s.phase='plus';s.message='Плюс: выберите закрытую клетку.';renderField();}
    else if(s.sector==='П'){s.phase='prize';s.message='Приз: взять или продолжить?';renderField();}
    else {s.phase='letter';s.message=s.sector==='Ш'?'Шанс: можно попросить подсказку зрителя, затем назвать букву за 1500.':`Сектор ${s.sector}: назовите букву.`;renderField();}
  },2400);
}
function fieldPass(message) {
  const s=fieldState;s.streak=0;
  const alive=s.players.filter(p=>!p.out);if(!alive.length){fieldEnd(null,'Все участники выбыли.');return;}
  for(let n=1;n<=s.players.length;n++){const i=(s.active+n)%s.players.length;if(!s.players[i].out){s.active=i;break;}}
  s.phase=s.soloHits>=3&&alive.length===1?'solveOnly':'spin';s.message=`${message} ${fieldCurrent(s).name}, ${s.phase==='solveOnly'?'назовите слово':'ваш ход'}.`;renderField();
}
function fieldEnd(winner,message) {
  const s=fieldState;s.phase='over';s.message=`${message} Ответ: ${s.question.answer}.`;
  if(fieldSuperTimer){clearInterval(fieldSuperTimer);fieldSuperTimer=null;}
  if(winner&&s.round<4)s.winners.push({name:winner.name,id:winner.id});
  if(winner&&s.round===4&&!s.superRound)s.champion={name:winner.name,id:winner.id,score:winner.score};
  renderField();
}
function fieldProductive(s){if(s.players.filter(p=>!p.out).length===1)s.soloHits++;}
function fieldAfterSuccess(s) {
  if([...s.question.answer].every(ch=>ch===' '||s.guessed.includes(fieldNorm(ch)))){fieldEnd(fieldCurrent(s),`${fieldCurrent(s).name} открыл(а) последнюю букву и победил(а)!`);return;}
  if(s.streak>=3){s.phase='chest';s.chestPrize=Math.floor(Math.random()*2);s.streak=0;s.message='Три верные буквы подряд! Выберите шкатулку.';}
  else {s.phase=s.players.filter(p=>!p.out).length===1&&s.soloHits>=3?'solveOnly':'spin';if(s.phase==='solveOnly')s.message='Три результативных хода: назовите слово целиком.';}
  renderField();
}
function fieldLetter(letter) {
  const s=fieldState;if(!s||!['letter','superLetters'].includes(s.phase))return;letter=fieldNorm(letter);
  if(letter.length!==1||!fieldAlphabet.includes(letter))return;
  if(s.phase==='superLetters'){if(s.guessed.includes(letter))return;s.guessed.push(letter);s.message=`Выбрано букв: ${s.guessed.length} из 5.`;if(s.guessed.length===5){s.phase='superSolve';s.seconds=60;s.deadline=Date.now()+60000;s.message='Назовите слово за 60 секунд.';fieldSuperTimer=setInterval(fieldSuperTick,250);}renderField();return;}
  if(s.guessed.includes(letter)){fieldPass('Буква уже называлась.');return;}
  s.guessed.push(letter);const count=[...s.question.answer].filter(ch=>fieldNorm(ch)===letter).length;
  if(!count){fieldPass(`Буквы ${letter} нет.`);return;}
  const p=fieldCurrent(s);if(s.sector==='×2')p.score*=count+1;else p.score+=(s.sector==='Ш'?1500:Number(s.sector)||0)*count;
  fieldProductive(s);s.streak++;s.message=`Буква ${letter}: ${count} · счёт ${p.score}. Ход сохраняется.`;fieldAfterSuccess(s);
}
function fieldPlus(index) {
  const s=fieldState;if(!s||s.phase!=='plus'||!Number.isInteger(index))return;
  const ch=[...s.question.answer][index],letter=fieldNorm(ch);if(!letter||s.guessed.includes(letter))return;
  s.guessed.push(letter);fieldProductive(s);s.message=`Открыта буква ${ch}. Очки не начисляются.`;fieldAfterSuccess(s);
}
function fieldPrize(choice) {
  const s=fieldState;if(!s||s.phase!=='prize')return;
  if(choice==='continue'){s.sector=2000;s.phase='letter';s.message='Продолжаем: 2000 очков за букву.';renderField();}
  else if(choice==='take'){fieldCurrent(s).out=true;s.soloHits=0;fieldPass('Приз взят: участник выбывает.');}
}
function fieldChest(index) {
  const s=fieldState;if(!s||s.phase!=='chest'||![0,1].includes(index))return;
  s.phase=s.players.filter(p=>!p.out).length===1&&s.soloHits>=3?'solveOnly':'spin';s.message=index===s.chestPrize?'В шкатулке виртуальный приз!':'Шкатулка пуста.';renderField();
}
function fieldSolve(value) {
  const s=fieldState;if(!s||!['spin','letter','solveOnly','superSolve'].includes(s.phase)||!fieldNorm(value))return;
  if(s.phase==='superSolve'){if(Date.now()>=s.deadline){fieldEnd(null,'Время вышло. Суперигра проиграна.');return;}fieldEnd(null,fieldNorm(value)===fieldNorm(s.question.answer)?'Суперигра выиграна! Виртуальный суперприз ваш.':'Неверно. Суперигра проиграна.');return;}
  if(fieldNorm(value)===fieldNorm(s.question.answer))fieldEnd(fieldCurrent(s),`${fieldCurrent(s).name} угадал(а) слово!`);
  else {const name=fieldCurrent(s).name;fieldCurrent(s).out=true;s.soloHits=0;fieldPass(`${name}: неверное слово, участник выбывает.`);}
}
function fieldSuperStart() {
  const s=fieldState;if(!s||s.phase!=='over'||s.superRound||!s.champion)return;
  if(!s.queue.length)s.queue=shuffle(window.FIELD_QUESTIONS.map((_,i)=>i));
  s.question=window.FIELD_QUESTIONS[s.queue.shift()];s.players=[{...s.champion,out:false}];s.active=0;s.guessed=[];s.sector=null;s.superRound=true;s.phase='superLetters';s.seconds=60;s.message='Назовите пять разных букв.';renderField();
}
function fieldSuperTick() {
  const s=fieldState;if(!s||s.phase!=='superSolve'){clearInterval(fieldSuperTimer);fieldSuperTimer=null;return;}
  const seconds=Math.max(0,Math.ceil((s.deadline-Date.now())/1000));
  if(!seconds){s.seconds=0;fieldEnd(null,'Время вышло. Суперигра проиграна.');return;}
  if(seconds!==s.seconds){s.seconds=seconds;saveField();const clock=$('.field-clock');if(clock)clock.innerHTML=`${seconds} <small>секунд</small>`;publish(fieldPublic(s));}
}
function fieldNext() {
  const s=fieldState;if(!s||s.phase!=='over')return;if(s.round===4){resetCurrentGame();return;}
  s.round++;s.phase='setup';s.question=null;s.players=[];s.active=0;s.guessed=[];s.sector=null;s.setupNames=['Игрок 1','Игрок 2','Игрок 3'];s.setupIds=['','',''];s.count=3;s.message='Подготовьте следующий тур.';renderField();
}
function fieldRemote(data) {
  const s=fieldState;if(!s)return;const action=data.action;
  if(data.role==='viewer'&&action?.kind==='reaction'&&['👏','🎉','❤️','😮'].includes(action.value)){s.reaction=`${data.name||'Зритель'} ${action.value}`;let box=$('.field-reaction');if(!box){box=document.createElement('div');box.className='field-reaction';$('.field-show')?.appendChild(box);}if(box)box.textContent=s.reaction;if(s.phase!=='spinning')publish(fieldPublic(s));return;}
  if(!action||typeof action!=='object'||!fieldCurrent(s)?.id||data.playerId!==fieldCurrent(s).id)return;
  if(action.kind==='spin')fieldSpin();else if(action.kind==='letter')fieldLetter(action.value);else if(action.kind==='solve')fieldSolve(action.value);else if(action.kind==='plus')fieldPlus(action.value);else if(action.kind==='prize')fieldPrize(action.value);else if(action.kind==='chest')fieldChest(action.value);
}

// --- Угадай мелодию: три игровых поля и суперигра ---
let melodyState = null;
let melodyAudio = null;
const melodyValues = [
  [80,40,90,60,70, 50,30,80,50,90, 80,40,50,70,30, 90,70,40,50,60],
  [60,80,40,90,70, 30,50,90,80,50, 70,80,40,30,50, 60,90,70,50,40],
  [90,50,70,40,80, 80,30,50,90,60, 50,70,30,80,40, 70,40,90,60,50]
];
const melodyRows = Array.from({length:4},(_,row)=>Array.from({length:5},(_,column)=>row*5+column));
function melodySong(state, index, superGame = false) {
  const position=superGame ? index : (state.tour-1)*20+index;
  const children=state.version === 'children';
  const language=children ? 'russian' : state.version === 'mixed' ? (position % 2 ? 'international' : 'russian') : state.version;
  const songIndex=superGame ? (children ? window.MELODY_CHILDREN_SUPER_TRACKS[index] : window.MELODY_SUPER_TRACKS[language][index]) : melodyLayout(state)[state.tour-1][Math.floor(index/5)][language === 'russian' ? 'ru' : 'en'][index%5];
  const source=language === 'russian' ? window.MELODY_RUSSIAN_SOURCES[songIndex] : null;
  return {title:window.MELODY_SONGS[language][songIndex],language,source,songIndex};
}
function bundledMelodyUrl(song) {
  if(!song) return null;
  return song.language==='russian' ? (window.MELODY_RUSSIAN_AUDIO_BY_INDEX?.[song.songIndex] || window.MELODY_RUSSIAN_AUDIO?.[song.title]) : window.MELODY_AUDIO?.[song.title];
}
function melodyValue(state,index=state.selected) { return melodyValues[state.tour-1][index]; }
function melodyLayout(state) {return state.version==='children' ? window.MELODY_CHILDREN_LAYOUT : window.MELODY_LAYOUT;}
function melodyCategories(state) {return melodyLayout(state)[state.tour-1].map(row=>row.name);}
function melodyKey(state, index = state.selected) { return `${state.version}-${state.tour}-${index}`; }
function stopMelodyAudio(clear = false) {
  if (melodyAudio) { melodyAudio.pause(); if (clear) melodyAudio = null; }
  const player = document.querySelector('#melodyExternalPlayer');
  if (player) { player.innerHTML = ''; player.hidden = true; }
}
function playMelodyAudio(url) {
  stopMelodyAudio(true);
  melodyAudio = new Audio(url);
  melodyAudio.play().catch(() => notify('Не удалось воспроизвести аудио. Попробуйте другой файл.'));
}
function disposeMelodyFiles() {
  stopMelodyAudio(true);
  stopSuperTimer();
  if (melodyState) [...Object.values(melodyState.files), ...Object.values(melodyState.cues)].forEach(file => URL.revokeObjectURL(file.url));
}
function publishMelody() {
  const s = melodyState;
  if (!s) return;
  if (s.tour===5) { publishAuction(); return; }
  if (s.tour===4) { publish({game:'melody',mode:'super',seconds:s.super.seconds,correct:7-s.super.queue.length,status:s.super.status,player:s.names[s.super.player]}); return; }
  const selectedSong = s.selected == null ? null : melodySong(s, s.selected);
  const categories=melodyCategories(s);
  publish({game:'melody', tour:s.tour, categories, rows:melodyRows.map(row => row.map(index => ({index, value:melodyValue(s,index), used:s.used[s.tour - 1].includes(index), selected:index === s.selected}))), scores:s.names.map((name,i)=>({name,score:s.scores[i]})), selectedValue:s.selected == null ? null : melodyValue(s), answer:s.revealed && selectedSong ? selectedSong.title : '', revealed:s.revealed});
}
function renderMelody() {
  const s = melodyState;
  const body = $('#gameBody');
  if(s.tour===4) { renderMelodySuper(); return; }
  if(s.tour===5) { renderMelodyAuction(); return; }
  const saved=saveMelody();
  const openDetails=['.melody-intro-image','.melody-cue-settings','.melody-song-list'].filter(sel=>body.querySelector(sel)?.open);
  const answerOpen=body.querySelector('.melody-answer')?.open && body.querySelector('.melody-answer')?.dataset.answerKey===melodyKey(s);
  const categories=melodyCategories(s);
  const song = s.selected == null ? null : melodySong(s, s.selected);
  const selectedUsed = s.selected != null && s.used[s.tour - 1].includes(s.selected);
  const uploadedFile = song && s.files[melodyKey(s)];
  const bundledUrl = bundledMelodyUrl(song);
  const youtubeId = song && (song.language === 'russian' ? song.source?.youtube : window.MELODY_YOUTUBE?.[song.title]);
  const file = uploadedFile || (bundledUrl ? {url:bundledUrl, name:'Встроенная запись'} : null);
  body.innerHTML = `<div class="melody-show melody-screen-view">
    <details class="melody-intro-image"><summary>Заставка «Угадай мелодию»</summary><img src="assets/melody/show-splash.png" alt="Заставка телепередачи Угадай мелодию"></details>
    <p class="game-save-status" role="status">${saveStatus(saved)} · выход из игры сохраняет прогресс</p><div class="melody-setup">
      <label>Песни <select id="melodyVersion"><option value="russian" ${s.version==='russian'?'selected':''}>На русском</option><option value="international" ${s.version==='international'?'selected':''}>На английском</option><option value="mixed" ${s.version==='mixed'?'selected':''}>Смешанные</option><option value="children" ${s.version==='children'?'selected':''}>Для детей и семьи</option></select></label>
      <span>3 тура · по 20 мелодий + суперигра</span><button type="button" id="melodyIntro">♫ Заставка</button><button type="button" id="melodyMusicStop">■ Стоп</button>
    </div>
    <details class="melody-cue-settings"><summary>Своя музыка для заставки и переходов</summary><p>Загрузите скачанные файлы со звуками шоу, если у вас есть право их использовать. Файлы останутся только до закрытия игры.</p><div><label>Заставка <input id="melodyIntroFile" type="file" accept="audio/*"></label><span>${s.cues.intro ? escapeHtml(s.cues.intro.name) : 'Стандартная заставка'}</span></div><div><label>Переход <input id="melodyTransitionFile" type="file" accept="audio/*"></label><span>${s.cues.transition ? escapeHtml(s.cues.transition.name) : 'Стандартный переход'}</span></div><a href="https://zvukipro.com/teleshow/716-zvuki-iz-teleperedachi-ugadaj-melodiju.html" target="_blank" rel="noopener noreferrer">Открыть страницу со звуками шоу ↗</a></details>
    <div class="melody-stage">
      <div class="melody-show-heading"><div><span>МУЗЫКАЛЬНАЯ ИГРА</span><h2>Угадай мелодию</h2></div><strong>ТУР ${s.tour} <small>/ 3</small></strong></div>
      <div class="melody-rounds" aria-label="Выбор тура">${[1,2,3].map(n=>`<button type="button" data-melody-tour="${n}" class="${s.tour===n?'active':''}" aria-pressed="${s.tour===n}">Тур ${n}</button>`).join('')}<button type="button" data-melody-tour="5">Торги ♫</button><button type="button" data-melody-tour="4">Суперигра ★</button></div>
      <p class="melody-board-hint">Выберите ноту и включите мелодию. В этом туре сыграно ${s.used[s.tour-1].length} из 20.</p>
      <div class="melody-board" aria-label="Игровое поле">${melodyRows.map((row,ri)=>`<div class="melody-board-row"><div class="melody-category">${escapeHtml(categories[ri])}</div><div class="melody-notes">${row.map(i=>`<button type="button" class="melody-note-tile ${s.used[s.tour-1].includes(i)?'used':''} ${s.selected===i?'selected':''}" data-melody-note="${i}" ${s.used[s.tour-1].includes(i)?'disabled':''} aria-label="${escapeHtml(categories[ri])}, ${melodyValue(s,i)} баллов${s.used[s.tour-1].includes(i)?', сыграно':''}" aria-pressed="${s.selected===i}"><span>${melodyValue(s,i)}</span></button>`).join('')}</div></div>`).join('')}</div>
      <div class="melody-scoreboard">${s.names.map((name,i)=>`<div class="melody-player-score"><span class="melody-player-number">${i+1}</span><div><label><span class="sr-only">Имя игрока ${i+1}</span><input data-melody-name="${i}" maxlength="24" value="${escapeHtml(name)}"></label><strong>${s.scores[i]}</strong></div></div>`).join('')}</div>
    </div>
    ${melodySongList(s)}
    <section class="melody-host-panel" aria-live="polite"><div class="melody-host-title"><div><span>ПУЛЬТ ВЕДУЩЕГО</span><h3>${song ? `Мелодия на ${melodyValue(s)} баллов` : 'Выберите ноту на поле'}</h3></div><span>${s.used[s.tour-1].length} / 20 сыграно</span></div>
      ${song ? `<details class="melody-answer" data-answer-key="${melodyKey(s)}"><summary>Подсказка ведущему: название песни</summary><p>${escapeHtml(song.title)}</p><a href="https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + (song.source?.artist || '') + ' новогодняя песня')}" target="_blank" rel="noopener noreferrer">Найти песню ↗</a></details>
      <div class="melody-audio-controls">${song.source?.source ? `<a class="melody-file" href="${escapeHtml(song.source.source)}" target="_blank" rel="noopener noreferrer">Слушать в источнике ↗</a>` : ''}${youtubeId ? `<button type="button" id="melodyYoutube">▶ Слушать на YouTube</button>` : ''}<label class="melody-file">${file ? 'Выбрать свой файл' : 'Добавить аудиофайл'}<input type="file" id="melodyFile" accept="audio/*"></label><button type="button" id="melodyPlay" ${file?'':'disabled'}>▶ Включить</button><button type="button" id="melodyStop" ${(file || youtubeId)?'':'disabled'}>■ Остановить</button><span>${file ? escapeHtml(file.name) : youtubeId ? 'Запись доступна онлайн через YouTube.' : song.source?.source ? 'Запись доступна на странице источника.' : 'Запись можно найти отдельно или добавить свой файл.'}</span></div>
      <div class="melody-judge"><span>Начислить или снять ${melodyValue(s)} баллов:</span>${s.names.map((name,i)=>`<div class="melody-judge-player"><b>${escapeHtml(name)}</b><button type="button" data-melody-score="${i}" data-direction="1" ${selectedUsed||s.judged[melodyKey(s)+'-'+i]?'disabled':''} aria-label="Начислить баллы: ${escapeHtml(name)}">+</button><button type="button" data-melody-score="${i}" data-direction="-1" ${selectedUsed||s.judged[melodyKey(s)+'-'+i]?'disabled':''} aria-label="Снять баллы: ${escapeHtml(name)}">−</button>${s.judged[melodyKey(s)+'-'+i]&&!selectedUsed?`<button type="button" data-melody-undo="${i}" aria-label="Отменить начисление или штраф: ${escapeHtml(name)}">↶</button>`:''}</div>`).join('')}</div>
      <div class="melody-actions"><button type="button" id="melodyReveal">${s.revealed?'Скрыть ответ':'Показать ответ на экране'}</button><button type="button" id="melodyDone" ${selectedUsed?'disabled':''}>Завершить мелодию ✓</button></div>` : '<p>Нажмите на любую доступную ноту. Название песни будет видно только ведущему после открытия подсказки.</p>'}
      <p class="melody-help">Некоторые русские и английские мелодии доступны без интернета; остальные — по ссылкам на источники или через YouTube. Плеер YouTube может показывать название и рекламу — лучше использовать отдельный экран. Заставку и переход можно заменить своими файлами.</p>
    </section>
  </div>`;
  openDetails.forEach(sel=>{const el=body.querySelector(sel);if(el)el.open=true;});
  if(answerOpen&&body.querySelector('.melody-answer'))body.querySelector('.melody-answer').open=true;
  $('#melodyVersion').addEventListener('change', e => {
    const version = e.target.value;
    if (!confirm('Сменить подборку и начать новую игру? Очки и сыгранные ноты будут сброшены.')) { e.target.value=s.version; return; }
    disposeMelodyFiles(); melodyState = newMelodyState(version); renderMelody();
  });
  $('#melodyIntro').addEventListener('click', () => { const intro=body.querySelector('.melody-intro-image'); intro.open=true; intro.scrollIntoView?.({behavior:'smooth',block:'start'}); playMelodyAudio(s.cues.intro?.url || 'assets/melody/audio/show-opening.mp3'); });
  for (const [id, cue] of [['melodyIntroFile','intro'],['melodyTransitionFile','transition']]) {
    $('#'+id).addEventListener('change', event => { const chosen=event.target.files[0]; if(!chosen) return; stopMelodyAudio(true); if(s.cues[cue]) URL.revokeObjectURL(s.cues[cue].url); s.cues[cue]={url:URL.createObjectURL(chosen),name:chosen.name}; renderMelody(); });
  }
  $('#melodyMusicStop').addEventListener('click', () => stopMelodyAudio());
  body.querySelectorAll('[data-melody-tour]').forEach(button => button.addEventListener('click', () => { const nextTour=Number(button.dataset.melodyTour); if(nextTour!==s.tour) playMelodyAudio(s.cues.transition?.url || 'assets/melody/audio/show-endround.mp3'); else stopMelodyAudio(); if(nextTour===5 && s.auction.phase==='setup') {const ranked=[0,1,2].sort((a,b)=>s.scores[b]-s.scores[a]);s.auction.players=ranked.slice(0,2);} if(nextTour===4 && s.tour!==4 && s.super.status==='ready' && s.auction.phase!=='finished') s.super.player=s.scores.indexOf(Math.max(...s.scores)); s.tour=nextTour; s.selected=null; s.revealed=false; renderMelody(); }));
  body.querySelectorAll('[data-melody-note]').forEach(button => button.addEventListener('click', () => { stopMelodyAudio(); s.selected=Number(button.dataset.melodyNote); s.revealed=false; renderMelody(); }));
  body.querySelectorAll('[data-melody-name]').forEach(input => input.addEventListener('input', () => {s.names[Number(input.dataset.melodyName)]=input.value.slice(0,24);saveMelody();}));
  body.querySelectorAll('[data-melody-name]').forEach(input => input.addEventListener('change', () => { s.names[Number(input.dataset.melodyName)]=input.value.trim().slice(0,24) || `Игрок ${Number(input.dataset.melodyName)+1}`; renderMelody(); }));
  $('#melodyFile')?.addEventListener('change', e => { const chosen=e.target.files[0]; if (!chosen) return; const key=melodyKey(s); stopMelodyAudio(true); if(s.files[key]) URL.revokeObjectURL(s.files[key].url); s.files[key]={url:URL.createObjectURL(chosen),name:chosen.name}; renderMelody(); });
  $('#melodyYoutube')?.addEventListener('click', () => {
    stopMelodyAudio(true);
    const player=$('#melodyExternalPlayer'); player.hidden=false;
    player.innerHTML=`<p>Плеер ведущего · название может быть видно. <a href="https://www.youtube.com/watch?v=${youtubeId}" target="_blank" rel="noopener noreferrer">Открыть на YouTube ↗</a></p><iframe title="Плеер музыкального фрагмента" src="https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    player.scrollIntoView?.({behavior:'smooth', block:'nearest'});
  });
  $('#melodyPlay')?.addEventListener('click', () => { if (!file) return; playMelodyAudio(file.url); });
  $('#melodyStop')?.addEventListener('click', () => stopMelodyAudio());
  body.querySelectorAll('[data-melody-score]').forEach(button => button.addEventListener('click', () => { const player=Number(button.dataset.melodyScore),key=melodyKey(s)+'-'+player; if(selectedUsed||s.judged[key]) return; const delta=Number(button.dataset.direction)*melodyValue(s);s.judged[key]=delta;s.scores[player] += delta; renderMelody(); }));
  body.querySelectorAll('[data-melody-undo]').forEach(button=>button.addEventListener('click',()=>{const player=Number(button.dataset.melodyUndo),key=melodyKey(s)+'-'+player;if(selectedUsed||!s.judged[key])return;s.scores[player]-=s.judged[key];delete s.judged[key];renderMelody();}));
  $('#melodyReveal')?.addEventListener('click', () => { s.revealed=!s.revealed; renderMelody(); });
  $('#melodyDone')?.addEventListener('click', () => { if(s.selected==null || selectedUsed) return; stopMelodyAudio(); s.used[s.tour-1].push(s.selected); s.selected=null; s.revealed=false; renderMelody(); if(s.used[s.tour-1].length===20) notify(s.tour<3?'Тур завершён! Выберите следующий тур.':'Тур завершён! Переходите к торгам.'); });
  publishMelody();
}
// Bonus duel: a host-operated adaptation of the show's seven-to-three-note bidding.
const auctionTracks={
  children:[
    {index:3,clue:'Песня о том, что было бы, если бы не было зимы.'},
    {index:22,clue:'Это деревце родилось в лесу.'},
    {index:32,clue:'Маленькое деревце зимой переезжает из леса в дом.'},
    {index:43,clue:'Песня про поезд, который бежит и качается.'},
    {index:44,clue:'Медвежонок советует ходить в гости по утрам.'}
  ],
  russian:[
    {index:3,clue:'Что случилось бы, если бы не было зимы?'},
    {index:7,clue:'Вьюга в январе звучит в известной кинокомедии.'},
    {index:5,clue:'Тройка уносит героя в звенящую снежную даль.'},
    {index:0,clue:'Танцевальный хит о приближении Нового года.'},
    {index:32,clue:'Маленькое деревце зимой переезжает из леса в дом.'}
  ],
  international:[
    {index:4,clue:'Зимняя поездка под звон колокольчиков.'},
    {index:6,clue:'Мечта о белом Рождестве.'},
    {index:1,clue:'История прошлогоднего Рождества.'},
    {index:14,clue:'Пусть за окном идёт снег.'},
    {index:26,clue:'Пожелание весёлого Рождества.'}
  ]
};
function auctionSong(s,i) {
  const language=s.version==='children'?'russian':s.version==='mixed'?(i%2?'international':'russian'):s.version;
  const track=auctionTracks[s.version==='children'?'children':language][i],songIndex=track.index;
  return {title:window.MELODY_SONGS[language][songIndex],language,songIndex,source:language==='russian'?window.MELODY_RUSSIAN_SOURCES[songIndex]:null,clue:track.clue};
}
function resetAuction(s){
  const ranked=[0,1,2].sort((a,b)=>s.scores[b]-s.scores[a]);
  s.auction={phase:'setup',players:ranked.slice(0,2),points:[0,0],track:0,turn:0,bid:null,bidder:null,lastWinner:null};
}
function publishAuction(){
  const s=melodyState,a=s.auction,song=auctionSong(s,a.track);
  publish({game:'melody',mode:'auction',phase:a.phase,clue:song.clue,bid:a.bid,turn:s.names[a.players[a.turn]],bidder:a.bidder===null?'':s.names[a.players[a.bidder]],players:a.players.map((id,i)=>({name:s.names[id],score:a.points[i]})),answer:a.phase==='result'||a.phase==='finished'?song.title:''});
}
function renderMelodyAuction(){
  const s=melodyState,a=s.auction,body=$('#gameBody'),song=auctionSong(s,a.track);
  const saved=saveMelody();
  const setup=a.phase==='setup', bidding=a.phase==='bidding',guessing=a.phase==='guess',finished=a.phase==='finished';
  const url=s.files['auction-'+a.track]?.url||bundledMelodyUrl(song);
  const youtube=song.language==='russian'?song.source?.youtube:window.MELODY_YOUTUBE?.[song.title];
  const phaseText=setup?'Выберите двух участников с лучшими результатами.':bidding?`Ход: ${escapeHtml(s.names[a.players[a.turn]])}`:guessing?`Отвечает: ${escapeHtml(s.names[a.players[a.bidder]])} · ${a.bid} нот`:finished?`Победитель: ${escapeHtml(s.names[a.players[a.lastWinner]])}`:`Очко получает ${escapeHtml(s.names[a.players[a.lastWinner]])}.`;
  body.innerHTML=`<div class="melody-show melody-screen-view"><p class="game-save-status" role="status">${saveStatus(saved)}</p><div class="melody-stage"><div class="melody-show-heading"><div><span>БОНУСНЫЙ РАУНД</span><h2>Торги ♫</h2></div><strong>ДО 3 ОЧКОВ</strong></div>
    <div class="melody-rounds">${[1,2,3].map(n=>`<button type="button" data-auction-tour="${n}">Тур ${n}</button>`).join('')}<button class="active" type="button" aria-current="page">Торги ♫</button><button type="button" data-auction-tour="4">Суперигра ★</button></div>
    <p class="melody-board-hint">${phaseText}</p><div class="auction-score">${a.players.map((p,i)=>`<div><b>${escapeHtml(s.names[p])}</b><strong>${a.points[i]}</strong></div>`).join('')}</div>
    ${setup?'':`<p class="auction-clue">Подсказка: ${escapeHtml(song.clue)}</p><p class="auction-bid">${a.bid===null?'Первая ставка: от 7 до 3 нот':`Текущая ставка: ${a.bid} нот`}</p>`}</div>
    <section class="melody-host-panel"><div class="melody-host-title"><div><span>ПУЛЬТ ВЕДУЩЕГО</span><h3>${setup?'Подготовка':bidding?'Назовите количество нот':guessing?'Проверьте ответ':'Результат'}</h3></div></div>
    ${setup?`<p>Выберите двух игроков. Начинает первый; каждый называет меньше нот или уступает сопернику. Три ноты завершают торги. При ошибке очко получает соперник. Победа — три очка.</p><div class="auction-players">${a.players.map((player,i)=>`<label>Участник ${i+1}<select data-auction-player="${i}">${s.names.map((name,j)=>`<option value="${j}" ${player===j?'selected':''}>${escapeHtml(name)}</option>`).join('')}</select></label>`).join('')}</div><button type="button" id="auctionStart">Начать торги</button>`:''}
    ${bidding?`<p>Ставка должна быть меньше предыдущей. Можно уступить после первой ставки.</p><div class="melody-actions">${[7,6,5,4,3].map(n=>`<button type="button" data-auction-bid="${n}" ${a.bid!==null&&n>=a.bid?'disabled':''}>${n} нот</button>`).join('')}<button type="button" id="auctionPass" ${a.bid===null?'disabled':''}>Уступить</button></div>`:''}
    ${guessing?`<details class="melody-answer"><summary>Ответ ведущему</summary><p>${escapeHtml(song.title)}</p></details><div class="melody-audio-controls"><button type="button" id="auctionPlay" ${url||youtube?'':'disabled'}>▶ Включить мелодию</button><button type="button" id="auctionStop">■ Остановить</button><label class="melody-file">Заменить файл<input type="file" id="auctionFile" accept="audio/*"></label></div><p>Записи не разбиты по нотам: ведущий останавливает воспроизведение самостоятельно после нужного числа нот.</p><div class="melody-actions"><button type="button" id="auctionCorrect">✓ Угадано</button><button type="button" id="auctionWrong">✕ Ошибка</button></div>`:''}
    ${a.phase==='result'||finished?`<p>Ответ: <b>${escapeHtml(song.title)}</b></p><button type="button" id="auctionNext">${finished?'К суперигре ★':'Следующая мелодия →'}</button>`:''}
    ${!setup?'<button type="button" class="auction-reset" id="auctionReset">Начать торги заново</button>':''}</section>${melodySongList(s)}</div>`;
  body.querySelectorAll('[data-auction-tour]').forEach(button=>button.addEventListener('click',()=>{stopMelodyAudio(true);s.tour=Number(button.dataset.auctionTour);s.selected=null;s.revealed=false;renderMelody();}));
  body.querySelectorAll('[data-auction-player]').forEach(select=>select.addEventListener('change',e=>{const side=Number(select.dataset.auctionPlayer),value=Number(e.target.value);if(value===a.players[1-side]){e.target.value=a.players[side];notify('Выберите двух разных игроков.');return;}a.players[side]=value;renderMelodyAuction();}));
  $('#auctionStart')?.addEventListener('click',()=>{a.phase='bidding';renderMelodyAuction();});
  body.querySelectorAll('[data-auction-bid]').forEach(button=>button.addEventListener('click',()=>{const bid=Number(button.dataset.auctionBid);if(!bidding||a.bid!==null&&bid>=a.bid)return;a.bid=bid;a.bidder=a.turn;if(bid===3)a.phase='guess';else a.turn=1-a.turn;renderMelodyAuction();}));
  $('#auctionPass')?.addEventListener('click',()=>{if(a.bid!==null){a.phase='guess';renderMelodyAuction();}});
  $('#auctionPlay')?.addEventListener('click',()=>{if(url)playMelodyAudio(url);else if(youtube){stopMelodyAudio(true);const player=$('#melodyExternalPlayer');player.hidden=false;player.innerHTML=`<p>Плеер ведущего · название может быть видно.</p><iframe title="Плеер торгов" src="https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;player.scrollIntoView?.({behavior:'smooth',block:'nearest'});}});
  $('#auctionStop')?.addEventListener('click',()=>stopMelodyAudio(true));
  $('#auctionFile')?.addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const key='auction-'+a.track;stopMelodyAudio(true);if(s.files[key])URL.revokeObjectURL(s.files[key].url);s.files[key]={url:URL.createObjectURL(file),name:file.name};renderMelodyAuction();});
  function decide(correct){if(a.phase!=='guess')return;stopMelodyAudio(true);a.lastWinner=correct?a.bidder:1-a.bidder;a.points[a.lastWinner]++;a.phase=a.points[a.lastWinner]>=3?'finished':'result';if(a.phase==='finished')s.super.player=a.players[a.lastWinner];renderMelodyAuction();}
  $('#auctionCorrect')?.addEventListener('click',()=>decide(true));$('#auctionWrong')?.addEventListener('click',()=>decide(false));
  $('#auctionNext')?.addEventListener('click',()=>{if(finished){s.tour=4;renderMelody();return;}a.track++;a.turn=a.lastWinner;a.bid=null;a.bidder=null;a.phase='bidding';renderMelodyAuction();});
  $('#auctionReset')?.addEventListener('click',()=>{if(!confirm('Начать торги заново?'))return;stopMelodyAudio(true);resetAuction(s);renderMelodyAuction();});
  publishAuction();
}

// Answers in this list are intentionally available only to the host, never sent to the projector.
function melodySongList(s) {
  const seen=new Set();
  const entry=song=>{const repeat=seen.has(song.title);seen.add(song.title);return `<li>${escapeHtml(song.title)}${repeat?' <small>(повтор названия)</small>':''}</li>`;};
  const rounds=[1,2,3].map(tour=>`<h4>Тур ${tour}</h4>${melodyLayout(s)[tour-1].map((row,ri)=>`<b>${escapeHtml(row.name)}</b><ol>${Array.from({length:5},(_,i)=>entry(melodySong({...s,tour},ri*5+i))).join('')}</ol>`).join('')}`).join('');
  return `<details class="melody-song-list"><summary>Список песен для ведущего · содержит ответы</summary>${rounds}<h4>Торги</h4><ol>${Array.from({length:5},(_,i)=>entry(auctionSong(s,i))).join('')}</ol><h4>Суперигра</h4><ol>${Array.from({length:7},(_,i)=>entry(melodySong(s,i,true))).join('')}</ol><p>Отмечены повторные названия; одинаковые названия могут относиться к разным записям.</p></details>`;
}
let melodySuperTimer=null;
function stopSuperTimer() { if(melodySuperTimer!==null) {clearInterval(melodySuperTimer);melodySuperTimer=null;} }
function superRemaining(s) {return Math.max(0,Math.ceil((s.super.deadline-Date.now())/1000));}
function finishSuper(status) {
  const s=melodyState;if(!s || s.super.status!=='running') return;
  s.super.seconds=superRemaining(s);s.super.status=status;stopSuperTimer();stopMelodyAudio(true);renderMelodySuper();
}
function checkSuperTime(s) {
  if(melodyState!==s || s.super.status!=='running') return false;
  const previous=s.super.seconds;s.super.seconds=superRemaining(s);
  if(s.super.seconds!==previous)saveMelody();
  if(s.super.seconds<=0) {finishSuper('lost');return false;}
  const clock=document.querySelector('#superSeconds');if(clock)clock.textContent=s.super.seconds;
  publishMelody();return true;
}
function playSuperTrack() {
  const s=melodyState;if(!s || !checkSuperTime(s)) return;
  const index=s.super.queue[0], song=melodySong(s,index,true);
  const uploaded=s.files['super-'+index];
  const url=uploaded?.url || bundledMelodyUrl(song);
  const youtube=song.language==='russian'?song.source?.youtube:window.MELODY_YOUTUBE?.[song.title];
  if(url) playMelodyAudio(url);
  else if(youtube) {
    stopMelodyAudio(true);const player=$('#melodyExternalPlayer');player.hidden=false;
    player.innerHTML=`<p>Плеер ведущего · название может быть видно. <a href="https://www.youtube.com/watch?v=${youtube}" target="_blank" rel="noopener noreferrer">Открыть на YouTube ↗</a></p><iframe title="Плеер суперигры" src="https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  } else notify('Для этой мелодии нет встроенного аудио.');
}
function renderMelodySuper() {
  const s=melodyState, body=$('#gameBody'), supergame=s.super;
  const saved=saveMelody();
  const index=supergame.queue[0], song=index===undefined?null:melodySong(s,index,true), running=supergame.status==='running';
  const youtube=song && (song.language==='russian'?song.source?.youtube:window.MELODY_YOUTUBE?.[song.title]);
  const url=song && (s.files['super-'+index]?.url || bundledMelodyUrl(song));
  const message=supergame.status==='paused'?'Суперигра приостановлена. Нажмите «Продолжить», когда будете готовы.':supergame.status==='won'?'Победа! Все семь мелодий угаданы.':supergame.status==='lost'?'Суперигра окончена: ошибка или время истекло.':'Угадайте семь мелодий за 30 секунд. Можно пропустить мелодию и вернуться к ней. Ошибка завершает игру.';
  body.innerHTML=`<div class="melody-show melody-screen-view"><p class="game-save-status" role="status">${saveStatus(saved)}</p><div class="melody-stage"><div class="melody-show-heading"><div><span>МУЗЫКАЛЬНАЯ ИГРА</span><h2>Суперигра ★</h2></div><strong id="superSeconds">${supergame.seconds}</strong></div>
    <div class="melody-rounds">${[1,2,3].map(n=>`<button type="button" data-super-tour="${n}" ${running?'disabled':''}>Тур ${n}</button>`).join('')}<button type="button" data-super-tour="5" ${running?'disabled':''}>Торги ♫</button><button class="active" type="button" aria-current="page">Суперигра ★</button></div>
    <p class="melody-board-hint">${message}</p><div class="melody-super-status"><b>${7-supergame.queue.length} / 7 угадано</b><label>Финалист <select id="superPlayer" ${running?'disabled':''}>${s.names.map((name,i)=>`<option value="${i}" ${i===supergame.player?'selected':''}>${escapeHtml(name)}</option>`).join('')}</select></label></div></div>
    <section class="melody-host-panel"><div class="melody-host-title"><div><span>ПУЛЬТ ВЕДУЩЕГО</span><h3>${running?`Мелодия ${7-supergame.queue.length+1} из 7`:'Готовы к финалу?'}</h3></div></div>
    ${song && running?`<details class="melody-answer"><summary>Название для ведущего</summary><p>${escapeHtml(song.title)}</p></details><div class="melody-audio-controls"><button type="button" id="superPlay" ${(url||youtube)?'':'disabled'}>▶ Повторить мелодию</button><button type="button" id="superStop">■ Остановить</button><label class="melody-file">Заменить файл<input type="file" id="superFile" accept="audio/*"></label><span>${url?'Встроенный фрагмент':youtube?'Запись YouTube':'Нет встроенной записи'}</span></div><div class="melody-actions"><button type="button" id="superCorrect">✓ Угадано</button><button type="button" id="superSkip">↻ Пропустить</button><button type="button" id="superWrong">✕ Ошибка</button></div>`:`<button type="button" id="superStart">▶ ${supergame.status==='paused'?'Продолжить суперигру':supergame.status==='ready'?'Начать суперигру':'Сыграть ещё раз'}</button>`}
    <p class="melody-help">Ведущий управляет звучанием и результатами. При переходе между мелодиями запись запускается автоматически. Онлайн-плеер может показывать название; для него нужен интернет. Суперигра — адаптация правил передачи для ведущего.</p></section>${melodySongList(s)}</div>`;
  $('#superPlayer').addEventListener('change',e=>{supergame.player=Number(e.target.value);saveMelody();publishMelody();});
  body.querySelectorAll('[data-super-tour]').forEach(button=>button.addEventListener('click',()=>{stopSuperTimer();stopMelodyAudio(true);s.tour=Number(button.dataset.superTour);if(s.tour===5 && s.auction.phase==='setup')resetAuction(s);s.selected=null;s.revealed=false;renderMelody();}));
  $('#superStart')?.addEventListener('click',()=>{stopSuperTimer();if(supergame.status!=='paused'){supergame.queue=[0,1,2,3,4,5,6];supergame.seconds=30;}supergame.deadline=Date.now()+supergame.seconds*1000;supergame.status='running';renderMelodySuper();playSuperTrack();melodySuperTimer=setInterval(()=>checkSuperTime(s),250);});
  $('#superPlay')?.addEventListener('click',playSuperTrack);
  $('#superStop')?.addEventListener('click',()=>stopMelodyAudio(true));
  $('#superFile')?.addEventListener('change',e=>{const chosen=e.target.files[0];if(!chosen || !checkSuperTime(s))return;const key='super-'+index;if(s.files[key])URL.revokeObjectURL(s.files[key].url);s.files[key]={url:URL.createObjectURL(chosen),name:chosen.name};renderMelodySuper();playSuperTrack();});
  $('#superCorrect')?.addEventListener('click',()=>{if(!checkSuperTime(s))return;supergame.queue.shift();if(!supergame.queue.length){finishSuper('won');return;}renderMelodySuper();playSuperTrack();});
  $('#superSkip')?.addEventListener('click',()=>{if(!checkSuperTime(s))return;supergame.queue.push(supergame.queue.shift());renderMelodySuper();playSuperTrack();});
  $('#superWrong')?.addEventListener('click',()=>{if(checkSuperTime(s))finishSuper('lost');});
  publishMelody();
}

function newMelodyState(version = 'russian') { return {version, tour:1, names:['Игрок 1','Игрок 2','Игрок 3'], scores:[0,0,0], used:[[],[],[]], selected:null, revealed:false, files:{}, cues:{}, judged:{}, auction:{phase:'setup',players:[0,1],points:[0,0],track:0,turn:0,bid:null,bidder:null,lastWinner:null}, super:{status:'ready',seconds:30,queue:[0,1,2,3,4,5,6],player:0,deadline:0}}; }

  // A separate, self-contained adaptation; the original PowerPoint is not converted.
  const holidayQuiz = [
    {q:'Как называется внучка Деда Мороза?',o:['Снегурочка','Золушка','Русалочка','Белоснежка'],a:0},
    {q:'Какое дерево чаще всего украшают на Новый год?',o:['Берёзу','Ёлку','Пальму','Дуб'],a:1},
    {q:'Как называется фигура из снежных шаров?',o:['Снеговик','Домовёнок','Гном','Дракон'],a:0}
  ];
  const holidayMovies = [
    {q:'Куда семья забыла взять Кевина в фильме «Один дома»?',o:['В школу','В отпуск','В магазин','В парк'],a:1},
    {q:'Как зовут почтальона в мультфильме «Зима в Простоквашино»?',o:['Печкин','Патрикеев','Сидоров','Матроскин'],a:0},
    {q:'Кто украл Рождество в известной истории?',o:['Гринч','Карлсон','Пятачок','Чебурашка'],a:0}
  ];
  const holidayMusic = [
    {id:'KCA3oUv1r4M',title:'Маленькой ёлочке холодно зимой'},
    {id:'NRdGSXPmn2s',title:'Расскажи, Снегурочка'},
    {id:'EaOu9c_WR7c',title:'Песенка о снежинке'}
  ];
  const holidayWords = [
    {q:'Его лепят из снега во дворе.',answer:'СНЕГОВИК'},
    {q:'Их дарят друг другу на праздник.',answer:'ПОДАРКИ'},
    {q:'Ледяная звёздочка, которая падает с неба.',answer:'СНЕЖИНКА'}
  ];
  let holidayState = null;
  function startHoliday() {
    holidayState={round:0,index:0,score:0,chosen:null,letters:[],reveal:false,playing:false};
    renderHoliday();
  }
  function renderHoliday() {
    const s=holidayState, body=$('#gameBody');
    const titles=['Викторина','Кино','Музыка','Поле чудес'];
    if (s.round===4) {
      body.innerHTML=`<section class="holiday-play"><span class="holiday-label">ИГРА ОКОНЧЕНА</span><h2>С Новым годом! ❄</h2><p>Командный счёт: <b>${s.score}</b> из 12</p><p>Спасибо за игру!</p><button id="holidayRestart" class="primary-button">Играть ещё раз</button><button id="holidayGuide" class="soft-button">К инструкции и комплекту</button></section>`;
      $('#holidayRestart').onclick=startHoliday;
      $('#holidayGuide').onclick=openHolidayInstructions;
      return;
    }
    const list=[holidayQuiz,holidayMovies,holidayMusic,holidayWords][s.round], item=list[s.index];
    let content='';
    if (s.round<2) {
      content=`<h2>${escapeHtml(item.q)}</h2><div class="holiday-answers">${item.o.map((option,i)=>`<button type="button" data-holiday-answer="${i}" ${s.chosen!==null?'disabled':''} class="${s.chosen!==null && i===item.a?'correct':s.chosen===i?'wrong':''}">${escapeHtml(option)}</button>`).join('')}</div>${s.chosen!==null?`<p class="holiday-feedback">${s.chosen===item.a?'Верно! +1 балл':'Не совсем. Правильный ответ подсвечен.'}</p>`:''}`;
    } else if (s.round===2) {
      content=`<h2>Продолжите песню</h2><p>Включите запись, остановите её в любом месте и предложите участникам продолжить. Ведущий оценивает ответ.</p><div class="holiday-audio"><button id="holidayListen" type="button">▶ Включить песню</button><button id="holidayStop" type="button">■ Остановить</button></div>${s.playing?`<iframe class="holiday-video" title="Песня" src="https://www.youtube-nocookie.com/embed/${item.id}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`:''}${s.chosen===null?'<div class="holiday-judge"><button id="holidayRight">Верно +1</button><button id="holidayWrong">Не угадали</button></div>':`<p class="holiday-feedback">${s.chosen?'Верно! +1 балл':'Попробуйте следующую песню.'} Название: ${escapeHtml(item.title)}</p>`}<p class="holiday-small">Для воспроизведения нужен интернет; YouTube может ограничивать показ или показывать название.</p>`;
    } else {
      const done=[...item.answer].every(ch=>s.letters.includes(ch));
      content=`<h2>${escapeHtml(item.q)}</h2><div class="holiday-word" aria-label="Загаданное слово">${[...item.answer].map(ch=>`<span>${s.reveal||s.letters.includes(ch)?ch:'&nbsp;'}</span>`).join('')}</div><div class="holiday-alphabet">${[...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'].map(ch=>`<button type="button" data-holiday-letter="${ch}" ${s.letters.includes(ch)||s.reveal||done?'disabled':''}>${ch}</button>`).join('')}</div>${done?'<p class="holiday-feedback">Слово угадано! +1 балл</p>':s.reveal?`<p class="holiday-feedback">Ответ: ${item.answer}</p>`:'<button type="button" id="holidayRevealWord" class="soft-button">Показать слово</button>'}`;
    }
    const canNext=s.round<3 ? s.chosen!==null : s.reveal||[...item.answer].every(ch=>s.letters.includes(ch));
    body.innerHTML=`<section class="holiday-play"><div class="holiday-play-top"><span class="holiday-label">РАУНД ${s.round+1} / 4 · ${titles[s.round]}</span><span>Счёт: <b>${s.score}</b></span></div><p class="holiday-progress">Задание ${s.index+1} из ${list.length}</p>${content}<div class="holiday-next"><button type="button" id="holidayNext" class="primary-button" ${canNext?'':'disabled'}>${s.index===list.length-1 ? (s.round===3?'Завершить игру':'Следующий раунд →') : 'Следующее задание →'}</button></div><p class="holiday-small">Браузерная адаптация по правилам комплекта; вопросы и медиа отличаются от оригинальной презентации.</p></section>`;
    body.querySelectorAll('[data-holiday-answer]').forEach(button=>button.onclick=()=>{if(s.chosen!==null)return; s.chosen=Number(button.dataset.holidayAnswer); if(s.chosen===item.a)s.score++; renderHoliday();});
    $('#holidayListen')?.addEventListener('click',()=>{s.playing=true;renderHoliday();});
    $('#holidayStop')?.addEventListener('click',()=>{s.playing=false;renderHoliday();});
    $('#holidayRight')?.addEventListener('click',()=>{s.chosen=true;s.score++;s.playing=false;renderHoliday();});
    $('#holidayWrong')?.addEventListener('click',()=>{s.chosen=false;s.playing=false;renderHoliday();});
    body.querySelectorAll('[data-holiday-letter]').forEach(button=>button.onclick=()=>{const ch=button.dataset.holidayLetter;if(s.letters.includes(ch)||s.reveal)return;s.letters.push(ch);if([...item.answer].every(c=>s.letters.includes(c)))s.score++;renderHoliday();});
    $('#holidayRevealWord')?.addEventListener('click',()=>{s.reveal=true;renderHoliday();});
    $('#holidayNext').onclick=()=>{if(!canNext)return;s.index++;if(s.index===list.length){s.round++;s.index=0;}s.chosen=null;s.letters=[];s.reveal=false;s.playing=false;renderHoliday();};
  }

  function openHolidayInstructions() {
    const body = commonFrame('Новогодняя игра', 'ЧЕТЫРЕ ПРАЗДНИЧНЫХ РАУНДА', 'Познакомьтесь с правилами, прежде чем начать.', 'holiday-screen');
    body.innerHTML = `<section class="holiday-guide"><div class="holiday-guide-intro"><span>❄ ДЛЯ УЧЕНИКОВ</span><h2>Играем вместе!</h2><p>Играйте всей компанией и помогайте друг другу. Вас ждут четыре раунда — ведущий объяснит задание перед каждым из них.</p></div>
      <ol class="holiday-round-list"><li><b>Новогодняя викторина</b><span>Читайте вопрос и выбирайте один правильный ответ из четырёх.</span></li><li><b>Кино-раунд</b><span>Отвечайте на вопросы о новогоднем кино.</span></li><li><b>Музыкальный раунд</b><span>Послушайте песню, затем продолжите её после остановки.</span></li><li><b>Новогоднее Поле чудес</b><span>Угадайте слово по вопросу, называя буквы.</span></li></ol>
      <div class="holiday-source"><h3>Играть на сайте</h3><p>Браузерная адаптация по правилам комплекта: четыре раунда и командный счёт. Вопросы отличаются от оригинала; в кино-раунде нет видеоотрывков.</p><button type="button" id="holidayStart" class="primary-button">Начать игру на сайте →</button><h3>Оригинальная игра</h3><p>Игра находится в презентации PowerPoint (351 МБ). Из-за её размера Google Диск может предложить скачать файл вместо показа в браузере. Для интерактивных переходов откройте скачанную презентацию в PowerPoint и запустите показ слайдов.</p><div class="holiday-actions"><a class="primary-button" href="https://drive.google.com/file/d/1fmAdYjsFhZEPXMQMf3L66cHbBRHsyEd-/view" target="_blank" rel="noopener noreferrer">Открыть презентацию ↗</a><a class="holiday-download" href="https://drive.google.com/drive/folders/1ZG3EVOkOO_ovAt0RBEzLBdrJ5iSXvz_m" target="_blank" rel="noopener noreferrer">↓ Скачать комплект с Google Диска</a></div><p class="holiday-small">В папке находятся презентация и полная инструкция автора. На Google Диске выберите «Скачать всё» или скачайте файлы по отдельности.</p><a class="holiday-original-guide" href="https://drive.google.com/file/d/1d_QCnQ2ZRxIXZJkoDUgdgcO13K_TJz6j/view" target="_blank" rel="noopener noreferrer">Открыть полную инструкцию автора ↗</a></div>
    </section>`;
    $('#holidayStart').addEventListener('click', startHoliday);
    publish({game:'idle',revealed:false,instruction:'Ведущий готовит новогоднюю игру.'});
  }

  function openGame(kind) {
    saveOpenGames();
    if(melodyState){disposeMelodyFiles();melodyState=null;}
    if(fieldSuperTimer){clearInterval(fieldSuperTimer);fieldSuperTimer=null;}
    fieldState=null;
    if (memoryState?.timer) clearInterval(memoryState.timer);
    if (crocState?.timer) clearInterval(crocState.timer);
    if(kind==='music'){openMusicLibrary();return;}
    if (kind==='drive') { openHolidayInstructions(); return; }
    if (kind==='field') { commonFrame('Поле чудес: Новый год','КРУТИТЕ БАРАБАН','Игра с экрана или с телефонами: три тройки и финал.','field-screen'); chooseSavedGame('field',saved=>{fieldState=saved||newFieldState();if(saved){fieldState.setupIds=fieldState.setupIds.map(id=>connectedPlayers.some(p=>p.id===id)?id:'');fieldState.players.forEach(p=>{if(!connectedPlayers.some(q=>q.id===p.id))p.id='';});if(fieldState.phase==='superSolve'){if(fieldState.seconds<=0){fieldState.phase='over';fieldState.message='Время вышло. Суперигра проиграна. Ответ: '+fieldState.question.answer+'.';}else{fieldState.deadline=Date.now()+fieldState.seconds*1000;fieldSuperTimer=setInterval(fieldSuperTick,250);}}}renderField();}); }
    if (kind==='melody' || kind==='melody-intl') { disposeMelodyFiles(); commonFrame('Угадай мелодию: Новый год','МУЗЫКАЛЬНАЯ ИГРА','Три игрока, три тура и суперигра.','melody-screen'); content.insertAdjacentHTML('beforeend', '<div id="melodyExternalPlayer" class="melody-external-player" hidden></div>'); chooseSavedGame('melody',saved=>{melodyState=saved?{...saved,files:{},cues:{}}:newMelodyState(kind==='melody-intl'?'international':'russian');renderMelody();}); }
    if (kind==='memo') { memoryState={...createContest(),pairs:15,deckId:'illustrated',extraMode:'classic',questionQueue:shuffle(memoQuestions.map((_,i)=>i)),questionCursor:0,lastQuestionIndex:null,factQueue:shuffle(memoFacts.map((_,i)=>i)),factCursor:0,lastFactIndex:null,pendingEvent:null,moves:0,seconds:0,deck:[],opened:[],matched:[],locked:false,timer:null,started:false}; renderMemo(); }
    if (kind==='guess') { guessState={...createContest(),playMode:'forehead',index:Math.floor(Math.random()*guessDeck.length),visible:false,screenVisible:true,asked:0,circlePlayers:[],circleHistory:[],activePlayerId:0,round:1}; renderGuess(); }
    if (kind==='croc') { const drawPile=shuffle(Array.from({length:100},(_,i)=>i)); crocState={...createContest(),pawns:crocPawnChoices.map(p=>p.id),card:drawPile.shift(),task:0,seconds:60,remaining:60,timer:null,track:Array(1).fill(0),scores:Array(1).fill(0),drawPile,discardPile:[],roundBlocked:{},round:1,turnsInRound:0,revealed:false,cardHidden:false,cardFaceUp:false,cardFlipAnimating:false,taskSelected:false,deckMode:'simple',finished:false}; renderCroc(); }
    if (kind==='quiz') { const teams=createContest('teams',2); quizState={...teams,active:Math.floor(Math.random()*2),questions:window.QUIZ_QUESTIONS||[],used:[],selected:null,selectedOption:null,revealed:false,answerResult:null,finished:false}; renderQuiz(); }
    if (kind==='crossword') { crosswordState={puzzleIndex:0,values:{},checked:false,solved:{},message:'Выбери подсказку и вписывай по одной букве в клетку.'}; renderCrossword(); publish({game:'idle',revealed:false,instruction:'Новогодний кроссворд открыт на основном устройстве.'}); }
  }
  document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>openGame(button.dataset.open)));
  $('#modalClose').addEventListener('click',closeGame);
  modal.addEventListener('click',event=>{if(event.target===modal)closeGame();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open')&&!document.fullscreenElement)closeGame();});

  function renderMemo() {
    const s=memoryState;if(s.timer)clearInterval(s.timer);
    const activeDeck=s.deckId==='photo'?photoMemoryDeck:memoryDeck;
    s.pairs=Math.min(s.pairs,activeDeck.length);
    const pairList=shuffle(activeDeck).slice(0,s.pairs);
    s.deck=shuffle(pairList.flatMap((card,id)=>[{...card,pair:id},{...card,pair:id}]));
    s.opened=[];s.matched=[];s.moves=0;s.seconds=0;s.locked=false;s.timer=null;s.started=false;s.pendingEvent=null;
    const maxPairs=activeDeck.length;
    const modeCopy=s.extraMode==='questions'?'После каждой найденной пары — один из 50 тестовых вопросов или заданий «правда/ложь» о Новом годе, его истории и традициях. Верный ответ: +2 бонусных балла.':s.extraMode==='facts'?'После каждых двух пар — один из 54 разных новогодних фактов. В пределах партии факты не повторяются.':'Открывай карточки, запоминай картинки и собирай пары.';
    const body=commonFrame('Мемо: Новый год','ТРЕНИРУЙ ПАМЯТЬ И НАХОДИ ПАРЫ',`${s.deckId==='photo'?'«Новогодняя фотоколлекция» по образцу оригинальной игры.':'Колода «Снежные иллюстрации».'} ${modeCopy}`,'memo-screen');
    body.innerHTML=`<div class="game-controls memo-options"><label class="pill-control">Колода<select id="memoDeck"><option value="illustrated" ${s.deckId==='illustrated'?'selected':''}>Снежные иллюстрации · 50 пар</option><option value="photo" ${s.deckId==='photo'?'selected':''}>Новогодняя фотоколлекция · ${photoMemoryDeck.length} пар</option></select></label><label class="pill-control">Режим<select id="memoExtraMode"><option value="classic" ${s.extraMode==='classic'?'selected':''}>Классика</option><option value="questions" ${s.extraMode==='questions'?'selected':''}>Вопросы · 50 · +2 бонуса</option><option value="facts" ${s.extraMode==='facts'?'selected':''}>Факты · 54 · каждые 2 пары</option></select></label><label class="pill-control">Пар <input id="pairCount" type="number" min="2" max="${maxPairs}" value="${s.pairs}"></label><button class="soft-button" id="memoApply">Применить · новая раскладка ↻</button><span class="stat-pill">Ходы <b id="memoMoves">0</b></span><span class="stat-pill">Время <b id="memoTime">00:00</b></span></div>${contestMarkup(s)}<div class="memory-grid ${s.deckId==='photo'?'photo-deck':''}" id="memoryGrid"></div><div id="memoEvent" aria-live="polite"></div><div id="memoResult"></div><p class="game-hint">Пара найдена — ход остаётся за вами. Ошибка — очередь переходит дальше.</p>`;
    const grid=$('#memoryGrid');
    s.deck.forEach((card,index)=>{
      const tile=document.createElement('button');tile.type='button';tile.className=`memory-tile card-style-${card.design??0}`;tile.setAttribute('aria-label',`Закрытая карточка ${index+1}`);tile.setAttribute('aria-pressed','false');
      tile.innerHTML=`<span class="memory-back-mark"><i>✦</i><b>${s.deckId==='photo'?'✺':'❄'}</b><i>✦</i><small>${s.deckId==='photo'?'НОВОГОДНЯЯ ФОТОКОЛЛЕКЦИЯ':'СНЕЖНЫЙ ПЕРЕПОЛОХ'}</small></span><span class="memory-face"><span class="memory-face-top"><i>${s.deckId==='photo'?'НОВОГОДНЯЯ ФОТОКОЛЛЕКЦИЯ':'СНЕЖНЫЕ ИЛЛЮСТРАЦИИ'}</i><b>${String(card.pair+1).padStart(2,'0')}</b></span><span class="memory-card-art">${card.image?`<img src="${card.image}" alt="${escapeHtml(card.name)}">`:`<span class="memory-emoji">${card.emoji}</span>`}</span><span class="memory-name">${escapeHtml(card.name)}</span><span class="memory-face-snow">✦　❄　✦</span></span>`;
      tile.addEventListener('click',()=>flipMemo(index));grid.appendChild(tile);
    });
    const pairInput=$('#pairCount'),deckSelect=$('#memoDeck');
    deckSelect.addEventListener('change',()=>{const limit=deckSelect.value==='photo'?photoMemoryDeck.length:memoryDeck.length;pairInput.max=String(limit);pairInput.value=String(Math.min(Number(pairInput.value)||15,limit));});
    $('#memoApply').addEventListener('click',()=>{s.deckId=deckSelect.value;s.extraMode=$('#memoExtraMode').value;const limit=s.deckId==='photo'?photoMemoryDeck.length:memoryDeck.length;s.pairs=Math.max(2,Math.min(limit,Number(pairInput.value)||15));renderMemo();});
    pairInput.addEventListener('keydown',e=>{if(e.key==='Enter')$('#memoApply').click();});
    bindContest(s,renderMemo);publishMemo();
  }
  function takeMemoQuestion(){const s=memoryState;if(s.questionCursor>=s.questionQueue.length){s.questionQueue=shuffle(memoQuestions.map((_,i)=>i));if(s.questionQueue.length>1&&s.questionQueue[0]===s.lastQuestionIndex)[s.questionQueue[0],s.questionQueue[1]]=[s.questionQueue[1],s.questionQueue[0]];s.questionCursor=0;}const index=s.questionQueue[s.questionCursor++];s.lastQuestionIndex=index;return memoQuestions[index];}
  function takeMemoFact(){const s=memoryState;if(s.factCursor>=s.factQueue.length){s.factQueue=shuffle(memoFacts.map((_,i)=>i));if(s.factQueue.length>1&&s.factQueue[0]===s.lastFactIndex)[s.factQueue[0],s.factQueue[1]]=[s.factQueue[1],s.factQueue[0]];s.factCursor=0;}const index=s.factQueue[s.factCursor++];s.lastFactIndex=index;return memoFacts[index];}
  function renderMemoEvent(){
    const host=$('#memoEvent'),s=memoryState,event=s?.pendingEvent;if(!host)return;
    if(!event){host.innerHTML='';return;}
    if(event.type==='question'){
      const q=event.item;
      const options=q.options.map((option,i)=>`<button class="memo-answer-option ${event.answered&&i===q.correct?'is-correct':''} ${event.answered&&i===event.chosen&&i!==q.correct?'is-wrong':''}" data-memo-answer="${i}" ${event.answered?'disabled':''}>${escapeHtml(option)}</button>`).join('');
      const feedback=event.answered?`<p class="memo-event-feedback ${event.wasCorrect?'is-correct':'is-wrong'}">${event.wasCorrect?`Верно! +${event.bonus} бонусных балла.`:`Правильный ответ: ${escapeHtml(q.options[q.correct])}. Ход переходит дальше.`}</p><button class="soft-button" id="memoContinue">Продолжить игру →</button>`:'';
      host.innerHTML=`<section class="memo-event memo-question"><div class="memo-event-kicker">${q.kind==='tf'?'ПРАВДА ИЛИ ЛОЖЬ':'НОВОГОДНИЙ ВОПРОС'} · +${event.bonus} БОНУСНЫХ БАЛЛА</div><h3>${escapeHtml(q.prompt)}</h3><div class="memo-answer-options">${options}</div>${feedback}</section>`;
      host.querySelectorAll('[data-memo-answer]').forEach(button=>button.addEventListener('click',()=>answerMemoQuestion(Number(button.dataset.memoAnswer))));
      $('#memoContinue')?.addEventListener('click',continueMemoEvent);
    }else{
      host.innerHTML=`<section class="memo-event memo-fact"><div class="memo-event-kicker">НОВЫЙ НОВОГОДНИЙ ФАКТ · ПАР СОБРАНО: ${Math.floor(s.matched.length/2)}</div><p>${escapeHtml(event.item)}</p><button class="soft-button" id="memoContinue">Продолжить игру →</button></section>`;
      $('#memoContinue').addEventListener('click',continueMemoEvent);
    }
    publishMemo();
  }
  function answerMemoQuestion(index){
    const s=memoryState,event=s?.pendingEvent;if(!event||event.type!=='question'||event.answered)return;
    event.answered=true;event.chosen=index;event.wasCorrect=index===event.item.correct;
    if(event.wasCorrect)s.scores[s.active]+=event.bonus;else s.active=(s.active+1)%s.names.length;
    refreshMemoScores();renderMemoEvent();
    notify(event.wasCorrect?`Верно! +${event.bonus} бонусных балла.`:'Неверный ответ — ход переходит дальше.');
  }
  function continueMemoEvent(){const s=memoryState;if(!s?.pendingEvent)return;s.pendingEvent=null;s.locked=false;renderMemoEvent();checkMemoFinished();publishMemo();}
  function checkMemoFinished(){
    const s=memoryState;if(!s||s.matched.length!==s.deck.length||s.pendingEvent)return;
    if(s.timer)clearInterval(s.timer);
    const high=Math.max(...s.scores),winners=s.names.filter((_,i)=>s.scores[i]===high).map(escapeHtml).join(' и ');
    const result=$('#memoResult');if(result)result.innerHTML=`<div class="win-panel">Все пары собраны за ${s.moves} ходов · ${fmtTime(s.seconds)} · победитель: ${winners} · ${high} баллов 🎉</div>`;
  }
  function flipMemo(index) {
    const s=memoryState;if(s.locked||s.pendingEvent||s.matched.includes(index)||s.opened.includes(index))return;
    if(!s.started){s.started=true;s.timer=setInterval(()=>{s.seconds++;const timer=$('#memoTime');if(timer)timer.textContent=fmtTime(s.seconds);},1000);}
    s.opened.push(index);const tile=$('#memoryGrid').children[index];tile.classList.add('revealed');tile.setAttribute('aria-label',s.deck[index].name);tile.setAttribute('aria-pressed','true');
    if(s.opened.length<2){publishMemo();return;}
    s.moves++;$('#memoMoves').textContent=s.moves;const [a,b]=s.opened;
    if(s.deck[a].pair===s.deck[b].pair){
      s.matched.push(a,b);s.opened=[];$('#memoryGrid').children[a].classList.add('matched');$('#memoryGrid').children[b].classList.add('matched');s.scores[s.active]++;refreshMemoScores();
      if(s.extraMode==='questions'){s.pendingEvent={type:'question',item:takeMemoQuestion(),answered:false,bonus:2};s.locked=true;renderMemoEvent();}
      else if(s.extraMode==='facts'&&(s.matched.length/2)%2===0){s.pendingEvent={type:'fact',item:takeMemoFact()};s.locked=true;renderMemoEvent();}
      checkMemoFinished();publishMemo();
    }else{
      s.locked=true;s.active=(s.active+1)%s.names.length;publishMemo();setTimeout(()=>{if(!$('#memoryGrid'))return;[a,b].forEach(i=>{const card=$('#memoryGrid').children[i];card.classList.remove('revealed');card.setAttribute('aria-label',`Закрытая карточка ${i+1}`);card.setAttribute('aria-pressed','false');});s.opened=[];s.locked=false;refreshMemoScores();publishMemo();},850);refreshMemoScores();
    }
  }
  function refreshMemoScores(){document.querySelectorAll('.score-chip').forEach((el,i)=>{el.classList.toggle('active',i===memoryState.active);const b=$('b',el);if(b)b.textContent=memoryState.scores[i]||0;});}
  function renderMemoBoardState(ignored){publishMemo();}

  function guessModeMarkup() {
    return `<div class="guess-mode-switch"><button class="guess-mode-option ${guessState.playMode==='forehead'?'active':''}" data-guess-mode="forehead">У доски · экран общий</button><button class="guess-mode-option ${guessState.playMode==='circle'?'active':''}" data-guess-mode="circle">Круг · телефоны</button></div>`;
  }
  function setGuessMode(mode) {
    guessState.playMode=mode;
    if(mode==='circle') syncCirclePlayers(connectedPlayers);
    else renderGuess();
  }
  function syncCirclePlayers(online) {
    if(!guessState || guessState.playMode!=='circle' || !modal.classList.contains('open')) return;
    const old=guessState.circleHistory||guessState.circlePlayers||[];
    const oldById=new Map(old.map(player=>[player.id,player]));
    const used=new Set(old.map(player=>player.card?.name).filter(Boolean));
    guessState.circlePlayers=online.map(member=>{
      const found=oldById.get(member.id);
      if(found){found.name=member.name;return found;}
      const available=guessDeck.map((card,index)=>({card,index})).filter(item=>!used.has(item.card.name));
      const chosen=(available.length?available:[{card:guessDeck[Math.floor(Math.random()*guessDeck.length)]}])[Math.floor(Math.random()*(available.length||1))];
      used.add(chosen.card.name);
      return {id:member.id,name:member.name,card:chosen.card,score:0};
    });
    for(const player of guessState.circlePlayers) if(!oldById.has(player.id)) old.push(player);
    guessState.circleHistory=old;
    if(!guessState.circlePlayers.some(player=>player.id===guessState.activePlayerId)) guessState.activePlayerId=guessState.circlePlayers[0]?.id||'';
    renderGuess();
  }
  function renderGuess() {
    const s=guessState;
    const isCircle=s.playMode==='circle';
    const description=isCircle?'Все участники подключаются со своих телефонов. У каждого своя карточка; на своём ходу игрок не видит её, а остальные отвечают на его вопросы.':'Угадывающий стоит спиной к общей доске. Остальные видят карточку и отвечают на вопросы «да» или «нет».';
    const body=commonFrame('Новогодние тарантинки','КТО ТЫ? УЗНАЙ С ПОМОЩЬЮ ВОПРОСОВ',description,'guess-screen');
    const card=guessDeck[s.index];
    const picker=`<section class="card-choice"><div class="picker-title">ВЫБЕРИ ОДНУ ИЗ ${guessDeck.length} КАРТОЧЕК</div><div class="guess-picker">${guessDeck.map((item,i)=>`<button class="guess-pick card-style-${item.design} ${i===s.index?'selected':''}" data-guess="${i}" title="${escapeHtml(item.name)}"><span class="guess-pick-number">${String(i+1).padStart(2,'0')}</span><span class="guess-pick-season">НОВЫЙ ГОД</span><span class="guess-pick-art">${item.image?`<img src="${item.image}" alt="">`:item.emoji}</span><span class="guess-pick-name">${escapeHtml(item.name)}</span><span class="guess-pick-flourish">✦ ❄ ✦</span></button>`).join('')}</div><button class="soft-button" id="guessRandom">Случайная карточка ✨</button></section>`;
    body.innerHTML=`${guessModeMarkup()}${isCircle?renderGuessCircleMarkup():`${contestMarkup(s)}<div class="guess-layout"><section class="guess-panel"><div class="guess-box"><div class="guess-label">КАРТОЧКА ${String(s.index+1).padStart(2,'0')} · СЛОВО ДЛЯ ОСТАЛЬНЫХ</div><div class="guess-turn-summary"><span class="guess-turn-icon">🗣️</span><span class="guess-turn-player"><small>СЕЙЧАС УГАДЫВАЕТ</small><b>${escapeHtml(s.names[s.active])}</b></span><span class="guess-turn-stat"><small>ВОПРОСОВ</small><b>${s.asked}</b></span><span class="guess-turn-stat"><small>ОЧКИ</small><b>${s.scores[s.active]||0}</b></span></div><div class="guess-board-status ${s.screenVisible?'is-shown':'is-hidden'}">${s.screenVisible?'❄ Карточка показана на общей доске':'🔒 Карточка скрыта на общей доске'}</div><div class="secret-card card-style-${card.design}"><span class="secret-card-label">НОВОГОДНЯЯ КАРТОЧКА · ${String(s.index+1).padStart(2,'0')}</span>${s.visible?`<span class="secret-emoji">${card.image?`<img src="${card.image}" alt="${escapeHtml(card.name)}">`:card.emoji}</span><span class="secret-word">${escapeHtml(card.name)}</span>`:'<span class="secret-hidden">?</span>'}</div><p class="guess-hint">${s.visible?'Карточка открыта ведущему для проверки.':'Угадывающий стоит спиной к доске; карточку видят остальные участники.'}</p><div class="guess-actions"><button class="solid-button" id="guessScreen" aria-pressed="${s.screenVisible}">${s.screenVisible?'Скрыть карточку с доски':'Показать карточку на доске'}</button><button class="soft-button" id="guessLocal">${s.visible?'Скрыть карточку у ведущего':'Показать ведущему'}</button><button class="soft-button" id="guessQuestion">Вопрос задан · ${s.asked}</button><button class="soft-button" id="guessCorrect">Угадали! +1 🎉</button><button class="soft-button" id="guessSkip">Пропустить карточку ↷</button></div></div><div class="guess-caption">Участник у доски задаёт вопросы, пока не угадает, что изображено на карточке.</div></section>${picker}</div>`}`;
    body.querySelectorAll('[data-guess-mode]').forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.guessMode;if(mode!==s.playMode){s.playMode=mode;if(mode==='circle')syncCirclePlayers(connectedPlayers);else renderGuess();}}));
    if(isCircle){bindGuessCircle();publishGuessCircle();return;}
    bindContest(s,renderGuess);
    $('#guessScreen').addEventListener('click',()=>{s.screenVisible=!s.screenVisible;renderGuess();});
    $('#guessLocal').addEventListener('click',()=>{s.visible=!s.visible;renderGuess();});
    $('#guessQuestion').addEventListener('click',()=>{s.asked++;renderGuess();});
    $('#guessCorrect').addEventListener('click',()=>{const winner=s.names[s.active];s.scores[s.active]++;s.active=(s.active+1)%s.names.length;s.index=randomOther(guessDeck.length,s.index);s.visible=false;s.screenVisible=true;s.asked=0;renderGuess();notify(`${winner} угадал(а)! +1 балл. Ход переходит ${s.names[s.active]}.`);});
    $('#guessSkip').addEventListener('click',()=>{const skipped=guessDeck[s.index].name;s.active=(s.active+1)%s.names.length;s.index=randomOther(guessDeck.length,s.index);s.visible=false;s.screenVisible=true;s.asked=0;renderGuess();notify(`Карточка «${skipped}» пропущена. Ход переходит ${s.names[s.active]}.`);});
    document.querySelectorAll('[data-guess]').forEach(button=>button.addEventListener('click',()=>{s.index=Number(button.dataset.guess);s.visible=false;s.screenVisible=true;s.asked=0;renderGuess();}));
    $('#guessRandom').addEventListener('click',()=>{s.index=randomOther(guessDeck.length,s.index);s.visible=false;s.screenVisible=true;s.asked=0;renderGuess();});
    publishGuess(s.screenVisible);
  }
  function renderGuessCircleMarkup(){
    const s=guessState,players=s.circlePlayers||[],active=players.find(player=>player.id===s.activePlayerId);
    const inviteUrl=appPageUrl(`player.html?room=${roomCode}`);
    const rows=players.length?players.map((player,index)=>`<div class="circle-player ${player.id===s.activePlayerId?'is-active':''}"><span class="circle-player-number">${index+1}</span><b>${escapeHtml(player.name)}</b><span class="circle-turn">${player.id===s.activePlayerId?'УГАДЫВАЕТ':'В КРУГУ'}</span><strong>${player.score||0} ★</strong></div>`).join(''):'<div class="circle-empty">Пока никто не подключился. Покажи QR или отправь адрес вместе с кодом комнаты.</div>';
    return `<div class="guess-circle-layout"><section class="circle-host-panel"><div class="circle-round-label">ТЕЛЕФОННЫЙ КРУГ · РАУНД ${s.round||1}</div><h3>${active?`${escapeHtml(active.name)} угадывает`: 'Подключи участников'}</h3><p>${active?'Остальные участники увидят карточку активного игрока на своих телефонах. Сам угадывающий своей карточки не видит.':`Игроки вводят имена и получают случайные зимние карточки. ${onlineSync?'Для игры подключите телефоны к интернету.':'Телефоны должны быть в одной сети с ведущим.'}`}</p><div class="local-join-box"><div class="local-qr-wrap"><img id="playerInviteQr" alt="QR-код входа в телефонный круг" hidden><div id="localQrPlaceholder">❄</div></div><div class="local-join-details"><b id="localInviteTitle">Подключение по QR-коду</b><p id="localInviteHint">Готовлю ссылку для телефонов…</p><div class="circle-invite"><span id="playerInviteUrl">${escapeHtml(inviteUrl)}</span><button class="soft-button" id="copyPlayerLink">Скопировать ссылку</button></div><div class="local-room-code">КОД КОМНАТЫ <strong>${roomCode}</strong><small>Можно ввести вручную после открытия страницы на телефоне</small></div></div></div><div class="circle-join-status">${players.length} ${players.length===1?'УЧАСТНИК ПОДКЛЮЧЁН':players.length>1?'УЧАСТНИКА ПОДКЛЮЧЕНО':'УЧАСТНИКОВ ПОДКЛЮЧЕНО'} · КОД ${roomCode}</div><div class="circle-player-list">${rows}</div><div class="circle-host-actions"><button class="solid-button" id="circleCorrect" ${!active?'disabled':''}>Угадал! +1 🎉</button><button class="soft-button" id="circlePass" ${!active?'disabled':''}>Пас · следующий участник →</button><button class="soft-button" id="circleNewRound" ${!players.length?'disabled':''}>Новый круг ↻</button></div><p class="circle-safety-note">${onlineSync?'Телефонам и компьютеру нужен интернет.':'Телефоны и компьютер должны быть в одной сети Wi-Fi.'} Оставьте игру ведущего открытой на время игры.</p></section><aside class="circle-phone-preview"><div class="phone-preview-frame"><div class="phone-preview-speaker"></div><div class="phone-preview-snow">❄</div><b>${active?'ТВОЯ ОЧЕРЕДЬ':'ЖДЁМ ИГРОКОВ'}</b><span>${active?'На своём ходу участник не увидит свою карточку.':'Телефон каждого участника покажет личную карточку.'}</span><div class="phone-preview-dots">●　●　●</div></div><div class="picker-title">КАРТОЧКИ НАЗНАЧАЮТСЯ ЛИЧНО</div></aside></div>`;
  }
  async function setupPlayerInvite(){
    const hint=$('#localInviteHint'),image=$('#playerInviteQr'),placeholder=$('#localQrPlaceholder'),urlLabel=$('#playerInviteUrl'),title=$('#localInviteTitle');
    if(!hint||!image)return;
    try{
      await shareOriginReady;
      if(onlineSync){image.src=window.makeInviteQr(appPageUrl(`player.html?room=${roomCode}`));image.hidden=false;if(placeholder)placeholder.hidden=true;if(urlLabel)urlLabel.textContent=appPageUrl(`player.html?room=${roomCode}`);title.textContent='Сканируй QR-код, чтобы войти';hint.textContent='Откройте ссылку на телефоне и введите имя. Устройства должны иметь доступ к интернету.';return;}
      if(!localAddressAvailable&&['localhost','127.0.0.1','::1'].includes(location.hostname))throw new Error('No local network address found');
      const response=await fetch('/api/qr.svg?text='+encodeURIComponent(appPageUrl(`player.html?room=${roomCode}`)),{cache:'no-store'});
      if(!response.ok)throw new Error('QR service unavailable');
      image.src=`/api/qr.svg?text=${encodeURIComponent(appPageUrl(`player.html?room=${roomCode}`))}`;image.hidden=false;if(placeholder)placeholder.hidden=true;
      if(urlLabel)urlLabel.textContent=appPageUrl(`player.html?room=${roomCode}`);
      title.textContent='Сканируй QR-код, чтобы войти';
      hint.textContent='Телефон откроет страницу участника. Устройства должны быть в одной Wi-Fi сети.';
    }catch{
      title.textContent='QR-код пока недоступен';
      hint.textContent='Можно скопировать ссылку и отправить её участникам. Устройства должны быть в одной Wi-Fi сети.';
      if(image)image.hidden=true;if(placeholder){placeholder.hidden=false;placeholder.textContent='❄';}
      if(urlLabel)urlLabel.textContent=appPageUrl(`player.html?room=${roomCode}`);
    }
  }
  function bindGuessCircle(){
    const s=guessState;
    setupPlayerInvite();
    $('#copyPlayerLink')?.addEventListener('click',async()=>{const url=$('#playerInviteUrl')?.textContent||appPageUrl(`player.html?room=${roomCode}`);try{await navigator.clipboard.writeText(url);notify('Ссылка для телефонов скопирована.');}catch{prompt(`Адрес телефонов · код комнаты ${roomCode}:`,url);}});
    $('#circleCorrect')?.addEventListener('click',()=>circleAnswer(true));
    $('#circlePass')?.addEventListener('click',()=>circleAnswer(false));
    $('#circleNewRound')?.addEventListener('click',()=>{
      const used=new Set();s.circlePlayers.forEach(player=>{const available=guessDeck.map(card=>card).filter(card=>!used.has(card.name));player.card=available[Math.floor(Math.random()*available.length)]||guessDeck[Math.floor(Math.random()*guessDeck.length)];used.add(player.card.name);});
      s.round=(s.round||1)+1;s.activePlayerId=s.circlePlayers[0]?.id||'';renderGuess();notify('Начался новый круг — карточки изменились.');
    });
    $('#copyPlayerLink')?.closest('.circle-invite')?.querySelector('span')?.addEventListener('click',e=>{if(navigator.clipboard)navigator.clipboard.writeText(e.currentTarget.textContent).then(()=>notify('Ссылка для телефонов скопирована.'));});
  }
  function circleAnswer(correct){
    const s=guessState,players=s?.circlePlayers||[];if(!players.length)return;
    const index=players.findIndex(player=>player.id===s.activePlayerId);if(index<0)return;
    if(correct){players[index].score=(players[index].score||0)+1;}
    const next=(index+1)%players.length;if(next===0)s.round=(s.round||1)+1;
    s.activePlayerId=players[next].id;renderGuess();notify(correct?`${players[index].name} угадал(а)! +1 балл.`:`Ход передан ${players[next].name}.`);
  }
  function publishGuess(reveal) { const card=guessDeck[guessState.index];publish({game:'guess',guessMode:'forehead',revealed:reveal,gameLabel:'НОВОГОДНИЕ ТАРАНТИНКИ',word:card.name,emoji:card.emoji,image:card.image,mode:'КАРТОЧКА '+String(guessState.index+1).padStart(2,'0'),team:guessState.names[guessState.active],instruction:'Угадывающий стоит спиной к экрану. Остальные задают вопросы, на которые отвечают «да» или «нет».'}); }
  function publishGuessCircle(){
    const s=guessState,players=s.circlePlayers||[],active=players.find(player=>player.id===s.activePlayerId);
    publish({game:'guess',guessMode:'circle',revealed:false,gameLabel:'НОВОГОДНИЕ ТАРАНТИНКИ',word:'',emoji:'',image:'',mode:`РАУНД ${s.round||1}`,team:active?.name||'',activePlayerId:s.activePlayerId||'',round:s.round||1,circleCards:players.map(player=>({id:player.id,name:player.name,word:player.card.name,emoji:player.card.emoji,image:player.card.image,style:player.card.design,hint:''})),instruction:'Участники смотрят карточки на телефонах. Активный игрок не видит свою карточку.'});
  }

  const methodTexts=[
    {name:'Объясни словами',icon:'💬',hint:'Объясни слово словами, не называя его и не используя однокоренные слова.'},
    {name:'Напой',icon:'🎵',hint:'Напой песню или мелодию, чтобы команда догадалась. Не произноси загаданное слово.'},
    {name:'Покажи',icon:'👣',hint:'Покажи слово жестами, мимикой и движениями — без слов и звуков.'},
    {name:'Нарисуй',icon:'🎨',hint:'Нарисуй подсказку на бумаге. Не пиши буквы и цифры.'},
    {name:'Значок «?»',icon:'❔',hint:'В оригинале есть значок вопроса, но его значение пока не подтверждено.'}
  ];
  function cardTasks(cardIndex,deckMode=crocState?.deckMode){const pool=deckMode==='hard'?promptsHard:promptsSimple;return Array.from({length:5},(_,slot)=>({...pool[(cardIndex*37+slot*19)%pool.length],method:methodTexts[slot]}));}
  function activeTask(){return cardTasks(crocState.card)[crocState.task];}
  function blockedOnCard(card,slot){return Boolean(crocState.roundBlocked[card]?.includes(slot));}
  function availableTasks(card){return cardTasks(card).map((_,i)=>i).filter(i=>!blockedOnCard(card,i));}
  function drawNextCrocCard(s){
    if(!s.drawPile.length&&s.discardPile.length){s.drawPile=shuffle(s.discardPile);s.discardPile=[];}
    let card=-1, checks=s.drawPile.length;
    while(checks--&&s.drawPile.length){const candidate=s.drawPile.shift();if(availableTasks(candidate).length){card=candidate;break;}s.drawPile.push(candidate);}
    if(card<0&&Object.keys(s.roundBlocked).length){s.roundBlocked={};s.round++;return drawNextCrocCard(s);}
    return card;
  }
  function advanceCrocTurn(s){s.active=(s.active+1)%s.names.length;s.turnsInRound++;if(s.turnsInRound>=s.names.length){s.turnsInRound=0;s.roundBlocked={};s.round++;}}
  function setCrocCardFace(s,faceUp){
    if(s.timer){clearInterval(s.timer);s.timer=null;}if(s.cardFaceUp&&!faceUp)s.revealed=false;
    s.cardFaceUp=faceUp;s.cardFlipAnimating=true;renderCroc();
    clearTimeout(s.cardFlipTimeout);
    s.cardFlipTimeout=setTimeout(()=>{s.cardFlipAnimating=false;document.querySelector('.croc-card-flip-frame')?.classList.remove('is-animating');},460);publishCroc(false);
  }
  function resetCrocDeck(s,deckMode){
    if(s.timer)clearInterval(s.timer);
    s.timer=null;s.deckMode=deckMode;s.drawPile=shuffle(Array.from({length:100},(_,i)=>i));s.discardPile=[];
    s.card=s.drawPile.shift();s.task=0;s.scores=Array(s.names.length).fill(0);s.track=Array(s.names.length).fill(0);
    s.active=0;s.round=1;s.turnsInRound=0;s.roundBlocked={};s.remaining=60;s.revealed=false;s.cardFaceUp=false;s.taskSelected=false;s.cardHidden=false;s.finished=false;
  }
  function renderCroc() {
    const s=crocState,tasks=cardTasks(s.card,s.deckMode),task=tasks[s.task];
    const body=commonFrame('Новогодний Суперкрокодил','6 ФИШЕК · 100 КАРТ · ПЕСОЧНЫЕ ЧАСЫ','Выберите одно из пяти слов и объясните его способом на карте. Угадали — передвиньте фишку на номер слова; не угадали — карта возвращается вниз колоды.','croc-screen');
    const board=Array.from({length:30},(_,i)=>{
      const rowFromBottom=Math.floor(i/6),step=i%6,row=4-rowFromBottom,column=rowFromBottom%2===0?step:5-step;
      const pawns=s.track.map((pos,j)=>pos===i?`<i title="${escapeHtml(s.names[j])}" style="--pawn-color:${crocPawnChoices.find(p=>p.id===s.pawns[j])?.color||'#2586cc'}">♟</i>`:'').join('');
      const specials={4:'💬',8:'🎵',12:'👣',16:'🎨',20:'❔',24:'🎵',27:'👣'};
      const endpoint=i===0?'СТАРТ':i===29?'ФИНИШ':'';
      return `<span class="board-cell ${specials[i]?'special-cell':''} ${s.track.some(pos=>pos===i)?'has-pawn':''} ${i===0?'start-cell':''} ${i===29?'finish-cell':''}" style="grid-row:${row+1};grid-column:${column+1}"><small>${specials[i]||'❄'}</small><b>${endpoint}</b><em class="board-arrow">${i===29?'🏁':rowFromBottom%2===0?(column===5?'↓':'→'):(column===0?'↓':'←')}</em><span class="board-pawns">${pawns}</span></span>`;
    }).join('');
    const cardRows=tasks.map((item,i)=>{
      const blocked=blockedOnCard(s.card,i);
      return `<button class="croc-task ${i===s.task&&s.taskSelected?'selected':''} ${blocked?'round-blocked':''}" data-task="${i}" ${blocked?'disabled':''}><span class="task-number">${i+1}</span><span class="task-icon">${item.method.icon}</span><span class="task-description"><b>${escapeHtml(item.word)}</b><small>${item.method.name} · ${blocked?'уже не выбирается в этом раунде':`ход на ${i+1} клет${i===0?'ку':i<4?'ки':'ок'}`}</small></span><span class="task-arrow">${i===s.task&&s.taskSelected?'●':'›'}</span></button>`;
    }).join('');
    const progress=s.track.map(pos=>`${pos}/29`).join(' · ');
    const cardMarkup=s.cardHidden?'':`<div class="croc-active-card"><div class="croc-card-top"><span class="card-label">КАРТА ${String(s.card+1).padStart(2,'0')} / 100</span><span class="croc-card-back-mark">❄</span></div><div class="croc-card-header"><span class="croc-card-question">?</span><div><b>Верхняя карта колоды</b><small>Выберите слово и способ объяснения</small></div></div><div class="task-mode">${s.taskSelected?`${task.method.icon} ${task.method.name} · СЛОВО ${s.task+1}`:'ВЫБЕРИТЕ ОДНО ИЗ ПЯТИ СЛОВ'}</div><div class="croc-word-art">${s.taskSelected?task.emoji:'❄️'}</div><div class="current-word ${s.revealed?'visible':''}">${s.revealed?escapeHtml(task.word):s.taskSelected?'Слово скрыто':'Задание ещё не выбрано'}</div><p class="task-hint">${s.revealed?escapeHtml(task.method.hint):s.taskSelected?'Слово скрыто. Объясните его способом, указанным на карточке.':'Переверните карточку справа и выберите одно из пяти слов.'}</p><div class="timer-line"><span class="hourglass-label">⏳ Песочные часы · 60 секунд</span><span id="crocTimer" class="timer-display">${fmtTime(s.remaining)}</span><button id="timerStart" ${s.taskSelected?'':'disabled'} class="soft-button">${s.timer?'Пауза':'Перевернуть часы'}</button></div><div class="task-actions"><button class="solid-button" id="crocShow" ${s.taskSelected?'':'disabled'}>${s.revealed?'Слово открыто':'Показать слово ведущему'}</button><button class="soft-button" id="crocScreen" ${s.taskSelected?'':'disabled'}>${screenCount?'Показать участникам':'На экран участникам'}</button><button class="soft-button" id="crocCorrect" ${s.taskSelected?'':'disabled'}>Угадали ✓</button><button class="soft-button" id="crocSkip" ${s.taskSelected?'':'disabled'}>Пропустить слово ↷</button></div></div>`;
    const winMarkup=s.finished?`<div class="win-panel croc-win">🏁 ${escapeHtml(s.names[s.active])} достигает финиша и побеждает! <button class="soft-button" id="crocAgain">Новая партия</button></div>`:'';
    const boardMarkup=`<div class="board-wrap"><div class="board-heading"><b>Игровое поле</b><span>Раунд ${s.round} · позиции: ${progress}</span></div><div class="board-track">${board}</div></div>`;
    const deckLabel=s.deckMode==='hard'?'СЛОЖНАЯ КОЛОДА':'ПРОСТАЯ КОЛОДА';
    const sideMarkup=s.cardHidden?'':`<aside class="croc-side"><div class="croc-side-tools"><div class="side-title">${deckLabel} · КАРТА ${String(s.card+1).padStart(2,'0')} / 100</div><button class="soft-button croc-flip-button" id="crocFlipCard" aria-pressed="${s.cardFaceUp}">${s.cardFaceUp?'Показать рубашку':'Перевернуть карту'}</button></div><div class="croc-card-flip-frame ${s.cardFaceUp?'is-face-up':'is-face-down'} ${s.cardFlipAnimating?'is-animating':''}" aria-live="polite">${s.cardFaceUp?`<div class="croc-card-front"><div class="croc-card-front-kicker">ЛИЦЕВАЯ СТОРОНА · 5 СЛОВ</div><div class="task-list">${cardRows}</div></div>`:`<div class="croc-card-back"><span class="croc-card-back-snow">❄</span><b>КАРТА ${String(s.card+1).padStart(2,'0')}</b><span>${s.deckMode==='hard'?'Сложная колода · прежний набор слов':'Простая колода · короткие слова'}</span><small>Переверните карту, чтобы увидеть пять заданий</small><div class="croc-card-back-flourish">✦　❄　✦　❄　✦</div></div>`}</div><div class="deck-status"><span>🂠 В колоде <b>${s.drawPile.length}</b></span><span>♻ В сбросе <b>${s.discardPile.length}</b></span></div><div class="components-note"><b>Комплект по референсу:</b><br>6 цветных фишек · 100 карточек по 5 слов · песочные часы на 60 секунд · поле с дорожкой от старта до финиша.</div><details class="croc-rules"><summary>Правила игры</summary><p>Разделитесь на команды по 2–3 человека, выберите фишки и жребием определите первый ход. В свой ход игрок команды берёт верхнюю карту, выбирает одно из пяти слов и объясняет его указанным способом, пока пересыпается песок. Если слово угадали, команда двигается вперёд на столько клеток, под каким номером было слово; карта отправляется в сброс. Если слово пропустить или не угадать, фишка остаётся на месте, а карта возвращается вниз колоды. Это слово нельзя повторно выбирать в текущем раунде, но другие слова с этой карты остаются доступными. После хода очередь переходит по часовой стрелке. Побеждает команда, первой достигшей финиша.</p></details></aside>`;
    body.innerHTML=`${contestMarkup(s)}<div class="croc-projection-bar"><label class="croc-deck-control">Колода<select id="crocDeckSelect" aria-label="Выбрать колоду"><option value="simple" ${s.deckMode==='simple'?'selected':''}>Простая · короткие слова</option><option value="hard" ${s.deckMode==='hard'?'selected':''}>Сложная · прежний набор</option></select></label><span class="croc-hidden-status croc-deck-note">Смена колоды начнёт новую партию</span><button class="soft-button" id="crocCardView" aria-pressed="${s.cardHidden}">${s.cardHidden?'Показать карточку с заданиями':'Скрыть карточку с заданиями'}</button>${s.cardHidden?`<span class="croc-hidden-status">❄ Поле для проектора · ход: ${escapeHtml(s.names[s.active])} · таймер приостановлен</span>`:`<span class="croc-hidden-status">Спрячьте слова, когда выводите поле на экран</span>`}</div><div class="croc-layout ${s.cardHidden?'board-only':''}"><section class="croc-main">${cardMarkup}${winMarkup}${boardMarkup}</section>${sideMarkup}</div>`;
    bindContest(s,()=>{if(s.timer)clearInterval(s.timer);s.timer=null;s.remaining=60;s.finished=false;s.roundBlocked={};s.turnsInRound=0;renderCroc();});
    if(s.finished){['#crocShow','#crocScreen','#timerStart','#crocCorrect','#crocSkip'].forEach(id=>{const el=$(id);if(el)el.disabled=true;});document.querySelectorAll('[data-task]').forEach(el=>el.disabled=true);$('#crocAgain').addEventListener('click',()=>{if(s.timer)clearInterval(s.timer);s.timer=null;s.scores=Array(s.names.length).fill(0);s.track=Array(s.names.length).fill(0);s.active=Math.floor(Math.random()*s.names.length);s.round=1;s.turnsInRound=0;s.roundBlocked={};s.drawPile=shuffle(Array.from({length:100},(_,i)=>i));s.discardPile=[];s.card=s.drawPile.shift();s.task=0;s.finished=false;s.remaining=60;s.revealed=false;s.cardHidden=false;s.cardFaceUp=false;s.taskSelected=false;renderCroc();publishCroc(false);});}
    $('#crocCardView').addEventListener('click',()=>{if(!s.cardHidden){if(s.timer){clearInterval(s.timer);s.timer=null;}s.revealed=false;}s.cardHidden=!s.cardHidden;renderCroc();publishCroc(s.revealed);});
    $('#crocFlipCard')?.addEventListener('click',()=>setCrocCardFace(s,!s.cardFaceUp));
    $('#crocDeckSelect').addEventListener('change',event=>{const nextDeck=event.target.value;if(nextDeck===s.deckMode)return;if(!window.confirm('Смена колоды начнёт новую партию и сбросит счёт. Продолжить?')){event.target.value=s.deckMode;return;}resetCrocDeck(s,nextDeck);renderCroc();publishCroc(false);notify(nextDeck==='hard'?'Началась партия со сложной колодой.':'Началась партия с простой колодой.');});
    $('#crocShow')?.addEventListener('click',()=>{s.revealed=!s.revealed;renderCroc();publishCroc(s.revealed);});
    $('#crocScreen')?.addEventListener('click',()=>{s.revealed=true;renderCroc();publishCroc(true);notify('Слово выведено на отдельный экран.');});
    $('#timerStart')?.addEventListener('click',toggleCrocTimer);
    $('#crocCorrect')?.addEventListener('click',()=>completeCrocTask(true));
    $('#crocSkip')?.addEventListener('click',()=>completeCrocTask(false,false,true));
    document.querySelectorAll('[data-task]').forEach(button=>button.addEventListener('click',()=>{if(button.disabled)return;if(s.timer)clearInterval(s.timer);s.timer=null;s.task=Number(button.dataset.task);s.taskSelected=true;s.revealed=false;s.remaining=60;renderCroc();publishCroc(false);}));
    publishCroc(s.revealed);
  }
  function completeCrocTask(correct,timedOut=false,skipped=false){
    const s=crocState;if(s.timer)clearInterval(s.timer);s.timer=null;
    const card=s.card,slot=s.task,word=activeTask().word;let skipNotice='';
    if(correct){s.discardPile.push(card);s.track[s.active]=Math.min(29,s.track[s.active]+slot+1);s.scores[s.active]=s.track[s.active];if(s.track[s.active]>=29){s.finished=true;notify(`Финиш! ${s.names[s.active]} выигрывает!`);}}
    else{const blocked=s.roundBlocked[card]||(s.roundBlocked[card]=[]);if(!blocked.includes(slot))blocked.push(slot);s.drawPile.push(card);const missMessage=timedOut?'Время вышло: фишка остаётся на месте, а слово нельзя повторить в этом раунде.':skipped?`Слово «${word}» пропущено. Карта вернётся в колоду, а слово нельзя выбрать повторно в этом раунде.`:`Слово «${word}» не угадали. Его нельзя повторно выбирать в этом раунде.`;if(skipped)skipNotice=missMessage;else notify(missMessage);}
    if(!s.finished){advanceCrocTurn(s);const next=drawNextCrocCard(s);if(next<0){s.finished=true;notify('В колоде не осталось доступных слов.');}else{s.card=next;s.task=availableTasks(next)[0];}}
    if(skipNotice)notify(s.finished?`${skipNotice} Партия завершена.`:`${skipNotice} Ход переходит ${s.names[s.active]}.`);
    s.remaining=60;s.revealed=false;s.cardFaceUp=false;s.taskSelected=false;renderCroc();publishCroc(false);
  }
  function toggleCrocTimer(){const s=crocState;if(s.timer){clearInterval(s.timer);s.timer=null;renderCroc();return;}if(!s.remaining){completeCrocTask(false,true);return;}s.timer=setInterval(()=>{s.remaining--;const t=$('#crocTimer');if(t){t.textContent=fmtTime(s.remaining);t.classList.toggle('urgent',s.remaining<=10);}publishCroc(s.revealed);if(s.remaining<=0){clearInterval(s.timer);s.timer=null;completeCrocTask(false,true);}},1000);$('#timerStart').textContent='Пауза';}
  function publishCroc(revealed){const s=crocState,task=activeTask(),selected=s.taskSelected;publish({game:'croc',revealed:Boolean(revealed&&selected),gameLabel:'НОВОГОДНИЙ СУПЕРКРОКОДИЛ',word:selected?task.word:'',emoji:selected?task.emoji:'❄️',mode:selected?`${task.method.icon} ${task.method.name.toUpperCase()}`:'ВЫБЕРИТЕ СЛОВО',team:s.names[s.active],instruction:selected?task.method.hint:'Переверните карточку и выберите одно из пяти слов.',timer:s.remaining});}

  const crosswordMusic={
    familyKaraoke:[
      {title:'В лесу родилась ёлочка · караоке',url:'https://www.youtube.com/watch?v=J6FEfQVp2NM',kind:'Русская новогодняя классика'},
      {title:'Маленькой ёлочке холодно зимой · караоке',url:'https://www.youtube.com/watch?v=DjzzeeI7tBs',kind:'Пойте всей семьёй'},
      {title:'Три белых коня · караоке',url:'https://www.youtube.com/watch?v=pZk7szlNXmo',kind:'Из фильма «Чародеи»'},
      {title:'Снег кружится · караоке',url:'https://www.youtube.com/watch?v=T_SsW0s0dv8',kind:'Зимний хит'}
    ],
    worldKaraoke:[
      {title:'Last Christmas · Wham! · караоке',url:'https://www.youtube.com/watch?v=JRNs1yGfbsU',kind:'Зарубежный поп-хит'},
      {title:'All I Want for Christmas Is You · Mariah Carey · караоке',url:'https://www.youtube.com/watch?v=0K-uCygyHpo',kind:'Праздничный поп · с текстом'},
      {title:'The Christmas Song · Nat King Cole · караоке',url:'https://www.youtube.com/watch?v=s1rgRFVUIJQ',kind:'Спокойная рождественская классика'},
      {title:'Santa Tell Me · Ariana Grande · караоке',url:'https://www.youtube.com/watch?v=QzFDehvDcdU',kind:'Современный поп-хит'},
      {title:'Feliz Navidad · José Feliciano · караоке',url:'https://www.youtube.com/watch?v=3qTDEpO7k8s',kind:'Английский и испанский'},
      {title:'Feliz Navidad · Boney M. · караоке',url:'https://www.youtube.com/watch?v=S4IVRsebTcc',kind:'Диско-версия · Sing King'}
    ],
    russianPlaylists:[
      {title:'Новогоднее караоке · русские песни',url:'https://www.youtube.com/playlist?list=PLBLLjqJ3RibTB4bTqBMeVTj3ZRFiZrOYk',kind:'Караоке-плейлист'},
      {title:'Детские новогодние песни-караоке',url:'https://www.youtube.com/playlist?list=PL7nI-G4MMmoyUw0S_5sV0CIDZlZ2uZ0c7',kind:'Семейная подборка'},
      {title:'Новогодние песни для детей',url:'https://www.youtube.com/playlist?list=PLcY6sOZibNcaRr56chAwlp_EXUuevSmxL',kind:'Спокойные знакомые песни'},
      {title:'Семейный новогодний плейлист · YouTube Music',url:'https://music.youtube.com/playlist?list=PLulPt1Ujpd5Oex7JA_GcWCU_VlTRhD1RB',kind:'Дополнение к любимой семейной подборке'}
    ],
    internationalPlaylists:[
      {title:'Christmas Karaoke Classics · Sing King',url:'https://www.youtube.com/playlist?list=PL8D4Iby0Bmm8OmcAYdZxiDl5igLVwFQ1J',kind:'Last Christmas, Santa Tell Me и другие хиты'},
      {title:'International Christmas Songs',url:'https://www.youtube.com/playlist?list=PLbZapce87T0eV_C4t_08WNYP2UrHr_q-E',kind:'Песни на разных языках'},
      {title:'Старые рождественские песни и джазовая классика',url:'https://www.youtube.com/playlist?list=PLK32o61rCfWHCOhi5AqIPqSlLX0Q3zTLK',kind:'Винтажная музыка для праздничного вечера'},
      {title:'Новогодние хиты и песни',url:'https://www.youtube.com/playlist?list=PL9Sagspadk-4pJwDSuNpPJQ63JF9NWPe0',kind:'Праздничный плейлист'}
    ],
    winterMixes:[
      {title:'Новогодние песни · лучшие песни на Новый год',url:'https://youtu.be/JDMBY5TBaGY',kind:'Русская праздничная подборка · 55 минут'},
      {title:'Лучшие новогодние песни · танцевальный сборник',url:'https://youtu.be/V32O3THLKTg',kind:'Танцевальные хиты · 1 час'},
      {title:'The best Christmas songs · 1 hour',url:'https://youtu.be/zw0xIbiw8fo',kind:'Зарубежная рождественская классика · 24 песни'}
    ],
    sharedPlaylists:[
      {title:'Merry Christmas 2025–2026 · полный плейлист',url:'https://www.youtube.com/playlist?list=PLZV0XspKK3fdUTw1xBgW4HtmkdngA-iGp',kind:'Все видео в одной подборке · 56 видео на YouTube'}
    ]
  };
  function crosswordLayout(puzzle){
    const entries=puzzle.entries.map((item,index)=>({...item,index,answer:item.answer.toUpperCase().replace(/Ё/g,'Е')}));
    const startKeys=[...new Set(entries.map(item=>`${item.row},${item.col}`))].sort((a,b)=>{const [ar,ac]=a.split(',').map(Number),[br,bc]=b.split(',').map(Number);return ar-br||ac-bc;});
    const numbers=new Map(startKeys.map((key,index)=>[key,index+1]));
    const cells=new Map();let rows=0,cols=0;
    entries.forEach(entry=>{
      entry.number=numbers.get(`${entry.row},${entry.col}`);
      entry.cells=[];
      const vertical=entry.direction==='down';
      [...entry.answer].forEach((letter,i)=>{
        const row=entry.row+(vertical?i:0),col=entry.col+(vertical?0:i),key=`${row},${col}`;
        let cell=cells.get(key);if(!cell){cell={row,col,letter,number:numbers.get(key)||0,entries:[]};cells.set(key,cell);}else if(cell.letter!==letter){console.error('Crossword letter mismatch',puzzle.id,key,cell.letter,letter);}
        cell.entries.push(entry.index);entry.cells.push(key);rows=Math.max(rows,row+1);cols=Math.max(cols,col+1);
      });
    });
    return{entries,cells,rows,cols};
  }
  function crosswordMusicMarkup(){
    const lists=[
      ['СЕМЕЙНОЕ КАРАОКЕ',crosswordMusic.familyKaraoke],
      ['ЗАРУБЕЖНЫЕ ХИТЫ · КАРАОКЕ',crosswordMusic.worldKaraoke],
      ['РУССКИЕ ПЛЕЙЛИСТЫ',crosswordMusic.russianPlaylists],
      ['ЗАРУБЕЖНОЕ И КЛАССИКА',crosswordMusic.internationalPlaylists],
      ['НОВОГОДНИЕ СБОРНИКИ',crosswordMusic.winterMixes],
      ['ЕЩЁ БОЛЬШЕ РОЖДЕСТВЕНСКОГО',crosswordMusic.sharedPlaylists]
    ];
    const links=lists.map(([heading,items])=>`<div class="crossword-music-group"><h4>${heading}</h4>${items.map(item=>`<a class="crossword-music-link" href="${item.url}" target="_blank" rel="noopener noreferrer"><span class="music-play">▶</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.kind)}</small></span><i>↗</i></a>`).join('')}</div>`).join('');
    return `<section class="crossword-music"><div class="crossword-music-head"><span>🎶</span><div><b>Музыкальная пауза</b><small>Семейные песни, зарубежные хиты, праздничные сборники и полный плейлист · ссылки откроются на YouTube</small></div></div><div class="full-playlist-panel"><div><b>Весь плейлист Merry Christmas 2025–2026</b><a href="https://www.youtube.com/playlist?list=PLZV0XspKK3fdUTw1xBgW4HtmkdngA-iGp" target="_blank" rel="noopener noreferrer">Открыть на YouTube ↗</a></div><iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=PLZV0XspKK3fdUTw1xBgW4HtmkdngA-iGp&amp;rel=0" title="Merry Christmas 2025–2026 — полный музыкальный плейлист" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="crossword-music-columns">${links}</div></section>`;
  }
  function openMusicLibrary(){
    const body=commonFrame('Новогоднее караоке и музыка','ВКЛЮЧАЙ И ПОДПЕВАЙ','Семейные песни, зарубежные хиты, полный рождественский плейлист и танцевальные сборники.','music-screen');
    body.innerHTML=crosswordMusicMarkup();
  }
  const warmupVideos=[
    {title:'X-mas New Year Immersive Interactive Warm-Up',url:'https://youtu.be/LLXGMDf7fS4',length:'2:53',kind:'Следуй за движениями и разогрейся перед игрой',symbol:'⚡'},
    {title:'Иммерсивное видео · Новогоднее',url:'https://youtu.be/YtT3Sz_uyc8',length:'интерактивное видео',kind:'Новогодняя разминка от Daniel Sfilms',symbol:'❄'}
  ];
  function openWarmupLibrary(){
    const body=commonFrame('Новогодние разминки','ВСТАЁМ И ПОВТОРЯЕМ ДВИЖЕНИЯ','Включите короткое интерактивное видео перед играми — повторяйте движения вместе с экраном.','warmup-screen');
    body.innerHTML=`<section class="warmup-library"><div class="warmup-grid">${warmupVideos.map((video,index)=>`<a class="warmup-video-card warmup-video-${index+1}" href="${video.url}" target="_blank" rel="noopener noreferrer"><div class="warmup-video-art"><span>${video.symbol}</span><i>▶</i></div><div class="warmup-video-info"><small>${escapeHtml(video.length)}</small><h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(video.kind)}</p><b>Открыть разминку ↗</b></div></a>`).join('')}</div><p class="warmup-note">Видео откроется на YouTube в новой вкладке. Проверьте звук и освободите немного места для движений.</p></section>`;
  }
  function renderCrossword(){
    const s=crosswordState,puzzles=window.CROSSWORD_PUZZLES||[],puzzle=puzzles[s.puzzleIndex];if(!puzzle)return;
    const layout=crosswordLayout(puzzle),entryByIndex=new Map(layout.entries.map(entry=>[entry.index,entry]));
    if(!entryByIndex.has(s.activeEntryIndex))s.activeEntryIndex=layout.entries.findIndex(entry=>entry.direction==='across');
    if(s.activeEntryIndex<0)s.activeEntryIndex=0;
    const active=entryByIndex.get(s.activeEntryIndex)||layout.entries[0];
    const body=commonFrame('Новогодние кроссворды','5 СЕТОК · 5 УРОВНЕЙ СЛОЖНОСТИ','Разгадывай зимние слова, открывай новые уровни и включай любимые новогодние песни.','crossword-screen');
    const puzzleNav=puzzles.map((item,i)=>`<button class="crossword-puzzle-pick ${i===s.puzzleIndex?'selected':''} ${s.solved[i]?'solved':''}" data-crossword-puzzle="${i}" aria-pressed="${i===s.puzzleIndex}"><span class="crossword-puzzle-index">${s.solved[i]?'✓':String(i+1).padStart(2,'0')}</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.difficulty)} · ${item.entries.length} слов</small></span></button>`).join('');
    const grid=[];
    for(let row=0;row<layout.rows;row++)for(let col=0;col<layout.cols;col++){
      const key=`${row},${col}`,cell=layout.cells.get(key);
      if(!cell){grid.push('<span class="crossword-block" aria-hidden="true"></span>');continue;}
      const value=s.values[key]||'',isActive=cell.entries.includes(s.activeEntryIndex),expected=value?value===cell.letter:null;
      const stateClass=s.checked?(expected?'is-correct':value?'is-wrong':'is-empty'):'';
      grid.push(`<label class="crossword-cell ${isActive?'is-active-word':''} ${stateClass}" style="grid-row:${row+1};grid-column:${col+1}" data-crossword-square="${key}">${cell.number?`<small>${cell.number}</small>`:''}<input class="crossword-letter" type="text" maxlength="1" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" data-crossword-cell="${key}" data-entries="${cell.entries.join(',')}" value="${escapeHtml(value)}" aria-label="Клетка ${row+1}, ${col+1}${cell.number?`, номер ${cell.number}`:''}"></label>`);
    }
    const clueList=direction=>layout.entries.map(entry=>({entry,index:entry.index})).filter(item=>item.entry.direction===direction).map(({entry,index})=>`<button class="crossword-clue ${index===s.activeEntryIndex?'active':''}" data-crossword-clue="${index}" aria-pressed="${index===s.activeEntryIndex}"><b>${entry.number}.</b><span>${escapeHtml(entry.clue)}</span></button>`).join('');
    const checkedSummary=s.message?`<div class="crossword-message ${s.solved[s.puzzleIndex]?'is-solved':''}" id="crosswordMessage" aria-live="polite">${escapeHtml(s.message)}</div>`:'';
    body.innerHTML=`<nav class="crossword-puzzle-nav" aria-label="Выбор кроссворда">${puzzleNav}</nav><div class="crossword-meta"><div><span class="crossword-difficulty">${escapeHtml(puzzle.difficulty)}</span><h3>${escapeHtml(puzzle.title)}</h3><p>${escapeHtml(puzzle.note)}</p></div><span class="crossword-word-count">${puzzle.entries.length} слов<br><b>${layout.rows} × ${layout.cols}</b></span></div><div class="crossword-layout"><section class="crossword-board-panel"><div class="crossword-board-scroll"><div class="crossword-board" style="--crossword-cols:${layout.cols};--crossword-rows:${layout.rows}">${grid.join('')}</div></div><div class="crossword-actions"><button class="solid-button" id="crosswordCheck">Проверить</button><button class="soft-button" id="crosswordReveal">Показать ответы</button><button class="soft-button" id="crosswordClear">Очистить</button></div><div class="crossword-progress" id="crosswordProgress">Слово ${active.number} · ${active.direction==='across'?'по горизонтали':'по вертикали'}</div>${checkedSummary}</section><aside class="crossword-clue-panel"><div class="crossword-clue-section"><h4>ПО ГОРИЗОНТАЛИ <span>→</span></h4><div class="crossword-clues">${clueList('across')}</div></div><div class="crossword-clue-section"><h4>ПО ВЕРТИКАЛИ <span>↓</span></h4><div class="crossword-clues">${clueList('down')}</div></div></aside></div>`;
    function selectClue(index){if(!entryByIndex.has(index))return;s.activeEntryIndex=index;body.querySelectorAll('.crossword-clue').forEach(el=>{const selected=Number(el.dataset.crosswordClue)===index;el.classList.toggle('active',selected);el.setAttribute('aria-pressed',String(selected));});body.querySelectorAll('.crossword-cell').forEach(el=>el.classList.toggle('is-active-word',entryByIndex.get(index).cells.includes(el.dataset.crosswordSquare)));$('#crosswordProgress',body).textContent=`Слово ${entryByIndex.get(index).number} · ${entryByIndex.get(index).direction==='across'?'по горизонтали':'по вертикали'}`;}
    body.querySelectorAll('[data-crossword-puzzle]').forEach(button=>button.addEventListener('click',()=>{const next=Number(button.dataset.crosswordPuzzle);if(next===s.puzzleIndex)return;s.puzzleIndex=next;s.values={};s.checked=false;s.message='Выбери подсказку и вписывай по одной букве в клетку.';s.activeEntryIndex=(window.CROSSWORD_PUZZLES[next].entries.findIndex(entry=>entry.direction==='across'));if(s.activeEntryIndex<0)s.activeEntryIndex=0;renderCrossword();}));
    body.querySelectorAll('[data-crossword-clue]').forEach(button=>button.addEventListener('click',()=>{selectClue(Number(button.dataset.crosswordClue));const entry=entryByIndex.get(s.activeEntryIndex),input=body.querySelector(`[data-crossword-cell="${entry.cells[0]}"]`);input?.focus();}));
    body.querySelectorAll('.crossword-letter').forEach(input=>{
      input.addEventListener('focus',()=>{const indices=input.dataset.entries.split(',').map(Number);if(!indices.includes(s.activeEntryIndex))selectClue(indices[0]);});
      input.addEventListener('input',()=>{const key=input.dataset.crosswordCell,letter=input.value.toUpperCase().replace(/Ё/g,'Е').replace(/[^А-Я]/g,'').slice(-1);input.value=letter;if(letter)s.values[key]=letter;else delete s.values[key];if(s.checked){s.checked=false;s.solved[s.puzzleIndex]=false;body.querySelectorAll('.crossword-cell').forEach(cell=>cell.classList.remove('is-correct','is-wrong','is-empty'));const nav=body.querySelector(`[data-crossword-puzzle="${s.puzzleIndex}"]`);if(nav){nav.classList.remove('solved');nav.querySelector('.crossword-puzzle-index').textContent=String(s.puzzleIndex+1).padStart(2,'0');}}s.message='';const indices=input.dataset.entries.split(',').map(Number);if(!indices.includes(s.activeEntryIndex))selectClue(indices[0]);if(letter){const cells=entryByIndex.get(s.activeEntryIndex).cells,index=cells.indexOf(key),next=index>=0?body.querySelector(`[data-crossword-cell="${cells[index+1]}"]`):null;next?.focus();}const msg=$('#crosswordMessage',body);if(msg)msg.textContent='';});
      input.addEventListener('keydown',event=>{const key=input.dataset.crosswordCell,[r,c]=key.split(',').map(Number);if(event.key==='Backspace'&&s.checked){s.checked=false;s.solved[s.puzzleIndex]=false;body.querySelectorAll('.crossword-cell').forEach(cell=>cell.classList.remove('is-correct','is-wrong','is-empty'));const nav=body.querySelector(`[data-crossword-puzzle="${s.puzzleIndex}"]`);if(nav){nav.classList.remove('solved');nav.querySelector('.crossword-puzzle-index').textContent=String(s.puzzleIndex+1).padStart(2,'0');}}if(event.key==='Backspace'&&!input.value){const cells=entryByIndex.get(s.activeEntryIndex).cells,index=cells.indexOf(key),prev=index>0?body.querySelector(`[data-crossword-cell="${cells[index-1]}"]`):null;if(prev){event.preventDefault();prev.focus();prev.value='';delete s.values[prev.dataset.crosswordCell];}}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const [dr,dc]=event.key==='ArrowLeft'?[0,-1]:event.key==='ArrowRight'?[0,1]:event.key==='ArrowUp'?[-1,0]:[1,0];let nr=r+dr,nc=c+dc,next=null;while(nr>=0&&nc>=0&&nr<layout.rows&&nc<layout.cols){next=body.querySelector(`[data-crossword-cell="${nr},${nc}"]`);if(next)break;nr+=dr;nc+=dc;}next?.focus();}else if(event.key==='Enter'){event.preventDefault();const nextIndex=(s.activeEntryIndex+1)%layout.entries.length;selectClue(nextIndex);const entry=entryByIndex.get(nextIndex);body.querySelector(`[data-crossword-cell="${entry.cells[0]}"]`)?.focus();}});
    });
    $('#crosswordCheck',body).addEventListener('click',()=>{
      let empty=0,wrong=0;layout.cells.forEach((cell,key)=>{const value=(s.values[key]||'').toUpperCase().replace(/Ё/g,'Е');if(!value)empty++;else if(value!==cell.letter)wrong++;});
      s.checked=true;s.solved[s.puzzleIndex]=empty===0&&wrong===0;s.message=s.solved[s.puzzleIndex]?'Отлично! Все буквы верны — кроссворд разгадан!':`Пока не всё совпало: пустых клеток — ${empty}, неверных букв — ${wrong}.`;
      renderCrossword();if(s.solved[s.puzzleIndex])notify('Кроссворд разгадан!');
    });
    $('#crosswordReveal',body).addEventListener('click',()=>{layout.cells.forEach((cell,key)=>s.values[key]=cell.letter);s.checked=true;s.solved[s.puzzleIndex]=true;s.message='Ответы открыты. Можно выбрать другой уровень или начать заново.';renderCrossword();});
    $('#crosswordClear',body).addEventListener('click',()=>{s.values={};s.checked=false;s.solved[s.puzzleIndex]=false;s.message='Поле очищено. Попробуй разгадать его ещё раз!';renderCrossword();});
  }

  function renderQuiz() {
    const s=quizState, questions=s.questions;
    const q=s.selected==null?null:questions[s.selected];
    const body=commonFrame('Новогодняя игра','70 ВОПРОСОВ · ОТВЕЧАЙТЕ И ЗАРАБАТЫВАЙТЕ БАЛЛЫ','Поле и правила из вашей PDF-викторины: выбирайте вопросы в любом порядке. Верный ответ даёт балл и ещё один ход; ошибка передаёт ход соперникам.','quiz-screen');
    const board=questions.map((item,i)=>`<button class="quiz-cell ${s.used.includes(i)?'used':''} ${s.selected===i?'chosen':''}" data-question="${i}" ${s.used.includes(i)||s.finished?'disabled':''} aria-label="Вопрос ${i+1}${s.used.includes(i)?', уже отвечен':''}"><span>${String(i+1).padStart(2,'0')}</span>${s.used.includes(i)?'<i>✓</i>':''}</button>`).join('');
    let questionPanel='';
    if(q){
      const options=q.type==='choice'?`<div class="quiz-options">${q.options.map((option,i)=>`<button class="quiz-option ${s.revealed&&i===q.correct?'correct':''} ${s.revealed&&i===s.selectedOption&&i!==q.correct?'incorrect':''}" data-option="${i}" ${s.revealed?'disabled':''}><b>${String.fromCharCode(65+i)}.</b><span>${escapeHtml(option)}</span></button>`).join('')}</div>`:'';
      const photo=q.image?`<img class="quiz-question-art" src="${q.image}" alt="Иллюстрация к вопросу ${q.id}">`:'';
      const answerPanel=s.revealed?`<div class="quiz-answer ${s.answerResult===false?'answer-missed':''}"><span>${s.answerResult===false?'Правильный ответ':'Ответ'}</span><strong>${escapeHtml(q.answer)}</strong></div>`:'';
      const action=q.type==='choice'
        ? (s.revealed?`<div class="quiz-feedback ${s.answerResult?'feedback-right':'feedback-wrong'}">${s.answerResult?'Верно! +1 балл, ход остаётся за вами.':'Не угадали — ход перейдёт другой команде.'}</div><button class="solid-button" id="quizContinue">Следующий вопрос →</button>`:'<p class="quiz-instruction">Выберите вариант ответа.</p>')
        : (s.revealed?`<div class="quiz-judge"><button class="solid-button" id="quizRight">Ответ верный · +1 балл</button><button class="soft-button" id="quizWrong">Не угадали · передать ход</button></div>`:'<button class="solid-button" id="quizReveal">Узнать ответ</button>');
      questionPanel=`<section class="quiz-question-card"><div class="quiz-question-top"><span>ВОПРОС ${String(q.id).padStart(2,'0')}</span><button class="soft-button" id="quizReturn">← К игровому полю</button></div><div class="quiz-pdf-layout"><div class="quiz-pdf-mascot"><img src="assets/quiz-pdf-child.webp" alt="Персонаж из исходной викторины">${photo}</div><div class="quiz-question-content"><div class="quiz-question-text">${escapeHtml(q.question)}</div>${options}${answerPanel}<div class="quiz-actions">${action}</div></div></div></section>`;
    } else {
      questionPanel=`<section class="quiz-question-card quiz-idle"><div class="quiz-idle-copy"><div class="section-kicker">ХОД: ${escapeHtml(s.names[s.active])}</div><h3>${s.finished?'Игра завершена!':'Новогодняя игра'}</h3><p>${s.finished?'Подсчитайте баллы и посмотрите, кто победил.':'Выберите любую свободную ячейку на поле и отвечайте на вопросы вместе с командой.'}</p>${s.finished?'<button class="solid-button" id="quizRestart">Начать заново ↻</button>':''}</div></section>`;
    }
    const topScore=Math.max(...s.scores);const topNames=s.names.filter((_,i)=>s.scores[i]===topScore).map(escapeHtml);
    const scoreSummary=s.finished?`<div class="quiz-finish">${topNames.length>1?'Ничья между':'Победитель:'} <b>${topNames.join(' и ')}</b> · ${topScore} баллов</div>`:'';
    body.innerHTML=`${contestMarkup(s)}<div class="quiz-toolbar"><div class="quiz-turn"><span class="turn-flake">❄</span><span>Сейчас отвечает: <b>${escapeHtml(s.names[s.active])}</b></span><span class="quiz-remain">Осталось ${questions.length-s.used.length} из 70</span>${s.used.length===0&&s.mode==='teams'&&s.names.length>1?'<span class="first-team-pill">Первый ход — по жребию</span>':''}</div><button class="soft-button" id="quizRaffle" ${s.finished?'disabled':''}>Жребий ↻</button><button class="soft-button quiz-end-button" id="quizEnd" ${s.finished||s.selected!==null?'disabled':''}>Завершить игру</button><a class="soft-button quiz-download-button" href="assets/quiz-presentation.pptx" download="Новогодняя-викторина.pptx">↓ Скачать презентацию</a><details class="quiz-rules"><summary>Правила игры</summary><p>В PDF-версии играют две команды. Команды по очереди выбирают любую из 70 ячеек. За верный ответ — 1 балл и дополнительный ход; за ошибку — передача хода. Ведущий определяет правильность ответа. Завершить игру можно кнопкой «Завершить игру» на поле; если открыть все 70 вопросов, игра завершится автоматически. Побеждает команда с большим числом баллов. В личном режиме игроки отвечают по очереди.</p></details></div>${scoreSummary}${questionPanel}<div class="quiz-board-wrap"><div class="quiz-board-heading"><span>ИГРОВОЕ ПОЛЕ</span><small>Свободные вопросы можно выбирать в любом порядке</small></div><div class="quiz-board">${board}</div></div>`;
    bindContest(s,()=>{s.used=[];s.selected=null;s.selectedOption=null;s.revealed=false;s.answerResult=null;s.finished=false;if(s.mode==='teams'&&s.names.length>1)s.active=Math.floor(Math.random()*s.names.length);else s.active=0;renderQuiz();});
    document.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>{s.selected=Number(button.dataset.question);s.selectedOption=null;s.revealed=false;s.answerResult=null;renderQuiz();}));
    document.querySelectorAll('[data-option]').forEach(button=>button.addEventListener('click',()=>{s.selectedOption=Number(button.dataset.option);s.answerResult=s.selectedOption===q.correct;s.revealed=true;renderQuiz();}));
    $('#quizRaffle').addEventListener('click',()=>{s.active=s.names.length>1?Math.floor(Math.random()*s.names.length):0;renderQuiz();notify(`Жребий: начинает ${s.names[s.active]}!`);});
    $('#quizEnd').addEventListener('click',()=>{if(s.finished||s.selected!==null)return;s.finished=true;renderQuiz();notify('Игра завершена.');});
    $('#quizReturn')?.addEventListener('click',()=>{s.selected=null;s.selectedOption=null;s.revealed=false;s.answerResult=null;renderQuiz();});
    $('#quizReveal')?.addEventListener('click',()=>{s.revealed=true;renderQuiz();});
    $('#quizRight')?.addEventListener('click',()=>completeQuizAnswer(true));
    $('#quizWrong')?.addEventListener('click',()=>completeQuizAnswer(false));
    $('#quizContinue')?.addEventListener('click',()=>completeQuizAnswer(Boolean(s.answerResult)));
    $('#quizRestart')?.addEventListener('click',()=>{s.used=[];s.scores=Array(s.names.length).fill(0);s.active=s.names.length>1?Math.floor(Math.random()*s.names.length):0;s.selected=null;s.selectedOption=null;s.revealed=false;s.answerResult=null;s.finished=false;renderQuiz();});
    publishQuiz();
  }
  function completeQuizAnswer(correct) {
    const s=quizState;
    if(s.selected==null)return;
    const answeringName=s.names[s.active];
    if(correct)s.scores[s.active]++;
    s.used.push(s.selected);
    if(!correct&&s.names.length>1)s.active=(s.active+1)%s.names.length;
    s.selected=null;s.selectedOption=null;s.revealed=false;s.answerResult=null;
    if(s.used.length===s.questions.length)s.finished=true;
    renderQuiz();
    notify(correct?`${answeringName} получает балл!`:'Ход передан следующей команде.');
  }
  function publishQuiz() {
    const s=quizState;if(!s)return;
    const q=s.selected==null?null:s.questions[s.selected];
    publish({game:'quiz',gameLabel:'НОВОГОДНЯЯ ВИКТОРИНА',questionNumber:q?.id||null,question:q?.question||'',type:q?.type||'',options:q?.options||[],questionImage:q?.image||'',revealed:Boolean(q&&s.revealed),answer:q&&s.revealed?q.answer:'',correctIndex:q&&s.revealed&&q.type==='choice'?q.correct:null,selectedOption:s.selectedOption,team:s.names[s.active],scores:s.names.map((name,i)=>({name,score:s.scores[i]})),remaining:s.questions.length-s.used.length,usedQuestions:s.used.slice(),selectedQuestion:s.selected==null?null:s.selected+1,finished:s.finished,instruction:q?'Ответьте вместе с командой!':'Выберите одну из оставшихся ячеек на поле.'});
  }

  function makeSnow(){
    const layer=$('.snow-layer');if(!layer)return;
    for(let i=0;i<30;i++){
      const flake=document.createElement('span');flake.className='snowflake';flake.textContent=['❄','✦','·'][Math.floor(Math.random()*3)];
      flake.style.left=`${Math.random()*100}%`;flake.style.animationDuration=`${8+Math.random()*13}s`;flake.style.animationDelay=`-${Math.random()*18}s`;
      flake.style.opacity=`${.3+Math.random()*.6}`;flake.style.fontSize=`${7+Math.random()*11}px`;layer.appendChild(flake);
    }
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let lastSpawn=0;
    window.addEventListener('pointermove',event=>{
      if((event.pointerType!=='mouse'&&event.pointerType!=='pen')||layer.style.display==='none')return;
      const now=performance.now();if(now-lastSpawn<38)return;lastSpawn=now;
      const count=3+(Math.random()>.6?2:0);
      const existing=[...layer.querySelectorAll('.cursor-snowflake')];
      while(existing.length>96-count)existing.shift().remove();
      for(let i=0;i<count;i++){
        const flake=document.createElement('span');flake.className='cursor-snowflake';flake.textContent=['❄','❅','✧','·','✦'][Math.floor(Math.random()*5)];
        flake.style.color=['#fff','#effcff','#dff6ff','#f4f0ff'][Math.floor(Math.random()*4)];
        flake.style.left=`${event.clientX+(Math.random()*24-12)}px`;flake.style.top=`${event.clientY+(Math.random()*18-9)}px`;
        flake.style.fontSize=`${11+Math.random()*14}px`;flake.style.setProperty('--flake-drift',`${Math.random()*82-41}px`);
        flake.style.setProperty('--flake-spin',`${Math.random()*220-110}deg`);flake.style.setProperty('--flake-duration',`${850+Math.random()*800}ms`);
        flake.addEventListener('animationend',()=>flake.remove(),{once:true});layer.appendChild(flake);
      }
    },{passive:true});
  }
  makeSnow();connectSync();
  $('#warmupOpen').addEventListener('click',openWarmupLibrary);
  $('#snowToggle').addEventListener('click',()=>{const layer=$('.snow-layer');const on=layer.style.display!=='none';layer.style.display=on?'none':'block';$('#snowToggle').innerHTML=`${on?'☼':'❄'} <span>${on?'Снегопад выкл.':'Снег идёт'}</span>`;});
})();
