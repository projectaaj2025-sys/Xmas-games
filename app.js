(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const modal = $('#gameModal');
  const content = $('#modalContent');
  const toast = $('#toast');
  let toastTimeout;
  let syncSocket, pendingState, screenCount = 0, connectedPlayers = [], syncAvailable = true;
  const roomCode = Math.random().toString(36).slice(2, 7).toUpperCase();
  let shareBaseUrl=new URL('.',location.href);
  let displayUrl=new URL(`display.html?room=${roomCode}`,shareBaseUrl).href;
  let memoryState, guessState, crocState, quizState, crosswordState;
  let localAddressAvailable=true;
  const appPageUrl=path=>new URL(path,shareBaseUrl).href;
  async function discoverShareOrigin(){
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
    'Варежки':'assets/mittens-card.webp','Снежинка':'assets/snowflake-card.webp','Санки':'assets/sled-card.webp','Колокольчик':'assets/bell-card.webp','Мандарин':'assets/mandarin-card.webp',
    'Снегирь':'assets/bullfinch-card.webp','Щелкунчик':'assets/nutcracker-card.webp','Снегурочка':'assets/snowmaiden-card.webp','Дед Мороз':'assets/dedmoroz-card.webp','Зимняя сова':'assets/memo-snowy-owl-card.webp','Пряничный человечек':'assets/tarantinki-gingerbread-card.webp','Имбирный пряник':'assets/tarantinki-gingerbread-card.webp','Имбирное печенье':'assets/tarantinki-gingerbread-card.webp','Печенье':'assets/tarantinki-gingerbread-card.webp','Белый медведь':'assets/polar-bear-card.webp','Пингвин':'assets/penguin-card.webp','Снежный шар':'assets/snow-globe-card.webp','Салат оливье':'assets/olivier-salad-card.webp','Фонарик':'assets/winter-lantern-card.webp','Письмо':'assets/letter-to-santa-card.webp','Иней':'assets/frost-window-card.webp','Мишура':'assets/festive-garland-card.webp','Ёлочная игрушка':'assets/ornament-card.webp','Мороз':'assets/blizzard-card.webp','Морозный узор':'assets/frost-window-card.webp','Ёлочный шар':'assets/ornament-card.webp','Гирлянда':'assets/festive-garland-card.webp','Зайчик':'assets/winter-bunny-card.webp','Заяц':'assets/winter-bunny-card.webp','Свеча':'assets/winter-candle-card.webp','Какао':'assets/cocoa-mug-card.webp','Сапожок':'assets/christmas-stocking-card.webp','Рождественский носок':'assets/christmas-stocking-card.webp','Ёлочная шишка':'assets/pine-cone-card.webp','Звезда':'assets/golden-star-card.webp','Полярная звезда':'assets/golden-star-card.webp','Рождественская звезда':'assets/golden-star-card.webp','Сосулька':'assets/icicle-card.webp','Ледяная сосулька':'assets/icicle-card.webp','Лыжи':'assets/skier-card.webp','Лыжник':'assets/skier-card.webp','Снегоступы':'assets/snowshoes-card.webp','Северное сияние':'assets/northern-lights-card.webp','Снежная крепость':'assets/snow-fort-card.webp','Снежный шарф':'assets/winter-scarf-card.webp','Тёплый шарф':'assets/winter-scarf-card.webp','Хлопушка':'assets/party-popper-card.webp','Подарочная лента':'assets/gift-ribbon-card.webp','Шапка':'assets/winter-hat-card.webp','Варежка':'assets/mittens-card.webp','Снегокат':'assets/sled-card.webp','Коньки':'assets/ice-skates-card.webp','Леденец':'assets/peppermint-lollipop-card.webp','Снежный ком':'assets/snowball-card.webp','Зимний сапог':'assets/winter-boot-card.webp','Валенки':'assets/winter-boot-card.webp','Чайник':'assets/teapot-card.webp','Лошадка-качалка':'assets/rocking-horse-card.webp','Письмо Деду Морозу':'assets/letter-to-santa-card.webp','Метель':'assets/blizzard-card.webp','Камин':'assets/fireplace-card.webp','Рождественский венок':'assets/christmas-wreath-card.webp','Подарочная коробка':'assets/gift-box-card.webp','Рождественский ангел':'assets/christmas-angel-card.webp'
  };
  const memoryDeck = [
    ['Ёлка','🎄'],['Подарок','🎁'],['Снеговик','⛄'],['Олень','🦌'],['Варежки','🧤'],['Снежинка','❄️'],['Санки','🛷'],['Колокольчик','🔔'],['Ёлочный шар','🔴'],['Имбирный пряник','🍪'],['Звезда','⭐'],['Мандарин','🍊'],['Сапожок','🧦'],['Свеча','🕯️'],['Сосулька','🧊'],['Зайчик','🐇'],['Коньки','⛸️'],['Снежный шар','🔮'],['Гирлянда','💡'],['Снегирь','🐦'],['Леденец','🍭'],['Щелкунчик','🪆'],['Подарочная лента','🎀'],['Фонарик','🏮'],['Пингвин','🐧'],['Шапка','🧢'],['Снежный ком','⚪'],['Зимний сапог','🥾'],['Чайник','🫖'],['Какао','☕'],['Печенье','🍪'],['Полярная звезда','🌟'],['Лошадка-качалка','🧸'],['Письмо Деду Морозу','✉️'],['Северное сияние','🌌'],['Белый медведь','🐻‍❄️'],['Ёлочная шишка','🌰'],['Снежная крепость','🏰'],['Метель','🌨️'],['Камин','🔥'],['Снегоступы','🎿'],['Хлопушка','🎉'],['Рождественский венок','🌿'],['Северный олень','🦌'],['Тёплый шарф','🧣'],['Лыжи','🎿'],['Зимняя сова','🦉'],['Подарочная коробка','📦'],['Морозный узор','❄️'],['Рождественский носок','🧦']
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
    {name:'Ёлочная шишка',emoji:'🌰',image:'assets/memo-photo-pinecone.webp'},
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
    {name:'Бенгальский огонь',emoji:'✨',image:'assets/memo-photo-sparklers.webp'},
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
    {name:'Хвоя и пряности',emoji:'🌿',image:'assets/memo-photo-cinnamon.webp'},
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
    ['Снегурочка','В старой сказке у зимы есть юная спутница.','Её цвет чаще напоминает лёд, чем пламя.','👸🏻'],
    ['Снеговик','Сугробу иногда помогают стать чуть более человечным.','Его нос обычно найдётся на кухне.','⛄'],
    ['Ёлка','Она собирает под собой шёпот упаковочной бумаги.','Зимой в доме появляется аромат леса.','🎄'],
    ['Олень','В северной сказке он знает дорогу лучше навигатора.','В небе его след оставляют не самолёты.','🦌'],
    ['Мандарин','Чистишь — и аромат приходит раньше гостей.','На праздничном столе этот запах часто открывает вечер.','🍊'],
    ['Снежинка','Ни один из миллионов экземпляров не повторяет другой.','Она исчезает от тепла, почти не оставляя следа.','❄️'],
    ['Подарок','Снаружи загадка, внутри обещание.','Его сначала перевязывают, а потом развязывают.','🎁'],
    ['Дед Мороз','В декабре многие ждут гостя, который приходит без приглашения.','Его появление часто сопровождает хруст упаковки.','🎅🏻'],
    ['Варежка','У неё есть отдельная компания для одного пальца.','Становится нужной, когда ладони хотят задержать тепло.','🧤'],
    ['Санки','Им не нужен мотор, чтобы спуск был быстрым.','По снегу они оставляют две длинные линии.','🛷'],
    ['Снегирь','На белом фоне у него есть маленькое красное пятно.','Он особенно заметен, когда ветви оголены.','🐦'],
    ['Ёлочный шар','Он ловит огоньки и отражает комнату вверх ногами.','На ветке держится осторожнее, чем кажется.','🔴'],
    ['Сосулька','Зимой дом иногда отращивает прозрачные клыки.','В солнечный полдень она начинает отвечать каплями.','🧊'],
    ['Белый медведь','Его адрес не перепутаешь с жаркой страной.','Белое на нём — не праздничный костюм.','🐻‍❄️'],
    ['Щелкунчик','Он стоит неподвижно, но в сказке умеет защищать.','Его имя связано с зимним угощением в скорлупе.','🪆'],
    ['Колокольчик','Его легко услышать, но трудно спутать с хлопком.','Маленький звон иногда сообщает, что кто-то приближается.','🔔'],
    ['Пряничный человечек','Он пахнет кухней, но может оказаться украшением.','На его лице часто рисуют улыбку белым.','🍪'],
    ['Пингвин','Его лучший костюм всегда при нём.','Крылья помогают ему, хотя в небо он не уходит.','🐧'],
    ['Снежный шар','Внутри маленький мир, который умеет устраивать бурю.','Чтобы он заволновался, достаточно встряхнуть.','🔮'],
    ['Гирлянда','Она превращает темноту в пунктир.','Её распутывают дольше, чем выбирают.','💡'],
    ['Заяц','Его следы иногда похожи на короткую загадку.','Длинные уши выдают его даже в сказке.','🐇'],
    ['Ледяная сосулька','Она появляется там, где талая вода встречает холод.','Её острый кончик направлен к земле.','🧊'],
    ['Лыжник','Две длинные линии помогают ему быстро идти по склону.','В руках у него пара тонких помощников.','🎿'],
    ['Северное сияние','Ночное небо иногда устраивает тихое представление.','Его цвета не включаются выключателем.','🌌'],
    ['Какао','Чашка согревает руки раньше, чем настроение.','Шоколадный запах часто приходит вместе с паром.','☕'],
    ['Хлопушка','Праздничный сюрприз начинается с короткого звука.','Её начинка разлетается в разные стороны.','🎉'],
    ['Рождественский носок','Он ждёт сюрприза, хотя в нём не ходят гулять.','У камина ему обычно выделяют место.','🧦'],
    ['Салат оливье','Его собирают маленькими кубиками и ставят в центр застолья.','Горошек в нём встречается с майонезом.','🥗'],
    ['Снежный шарф','Он становится длиннее, когда его разворачивают.','Хорошо знаком с ветром и шеей.','🧣'],
    ['Ёлочная шишка','Она падает с хвойных, но зимой попадает в украшения.','Её чешуйки напоминают маленькие веера.','🌰'],
    ['Фонарик','Он несёт собственный кусочек света.','В темноте его удобно держать за рукоять.','🏮'],
    ['Зимняя сова','Она замечает движение почти бесшумно.','В ночной сказке её глаза видны раньше крыльев.','🦉'],
    ['Рождественская звезда','Её образ ищут высоко над праздничным деревом.','Она связана с древней историей пути и света.','🌟'],
    ['Морозный узор','Утром стекло может показать работу невидимого художника.','Его рисунок исчезает, когда в комнате теплеет.','❄️'],
    ['Имбирное печенье','В нём пряность появляется раньше сладости.','Иногда его украшают тонкими белыми линиями.','🍪'],
    ['Подарочная лента','Она делает коробку наряднее, не открывая её.','Часто заканчивается двумя петлями.','🎀'],
    ['Валенки','В них шаги становятся мягче, а холод — дальше.','Их делают из свалянной шерсти.','🥾'],
    ['Шапка','Её надевают прежде, чем выйти навстречу ветру.','Верх головы благодарит за неё в мороз.','🧢'],
    ['Письмо Деду Морозу','На бумаге можно оставить желание, которое пока держат в секрете.','У адресата этого послания есть привычка приходить зимой.','✉️'],
    ['Иней','Он оставляет серебро на ветках, не используя кисть.','Появляется ночью и отступает при тепле.','❄️'],
    ['Мишура','Она шуршит, блестит и редко лежит ровно.','Её любят накидывать поверх хвои.','✨'],
    ['Ёлочная игрушка','Она проводит праздник на высоте ветки.','В коробке её лучше хранить мягко.','🔴'],
    ['Хоровод','Тут важно двигаться по кругу и не потерять соседей.','Праздничная песня помогает держать шаг.','💃'],
    ['Мороз','Его присутствие узнают по дыханию в воздухе.','Он умеет рисовать на стекле, не беря кисть.','🥶'],
    ['Календарь','Он делит ожидание на клеточки.','Последняя страница года приходит с особенным чувством.','📆']
  ].map(([name, hint1, hint2, emoji], design) => ({ name, hint1, hint2, emoji, design:design%6, image:aiCardArt[name] || '' }));

  const prompts = [
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
  const methods = [
    { name: 'Слова', icon: '💬', hint: 'Объясни словами, не называя само слово и его однокоренные.' },
    { name: 'Вопросы', icon: '❔', hint: 'Помоги команде догадаться, задавая наводящие вопросы.' },
    { name: 'Рисунок', icon: '✏️', hint: 'Нарисуй подсказку. Не пиши буквы и цифры.' },
    { name: 'Пантомима', icon: '🙌', hint: 'Покажи слово движениями, не произнося ни звука.' },
    { name: 'Песня', icon: '🎵', hint: 'Напой мелодию или спой, не произнося загаданное слово.' }
  ];
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
  function sendSync(message) { if (syncSocket?.readyState === WebSocket.OPEN) syncSocket.send(JSON.stringify(message)); else pendingState = message; }
  function connectSync() {
    if(location.hostname.endsWith('.github.io')){syncAvailable=false;updateScreenStatus(false);return;}
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    syncSocket = new WebSocket(`${scheme}//${location.host}/sync`);
    syncSocket.addEventListener('open', () => { syncAvailable=true; syncSocket.send(JSON.stringify({type:'join', room:roomCode, role:'host'})); if (pendingState) { syncSocket.send(JSON.stringify(pendingState)); pendingState = null; } });
    syncSocket.addEventListener('message', event => {
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'presence') {
        screenCount = data.count || 0; connectedPlayers = Array.isArray(data.players) ? data.players : []; updateScreenStatus();
        if (guessState?.playMode === 'circle') syncCirclePlayers(connectedPlayers);
      }
      if (data.type === 'joined') { screenCount = data.screenCount || 0; updateScreenStatus(); }
      if (data.type === 'player-action' && guessState?.playMode === 'circle' && data.playerId === guessState.activePlayerId) circleAnswer(data.action === 'solved');
    });
    syncSocket.addEventListener('close', () => { syncAvailable=false;updateScreenStatus(false);setTimeout(connectSync,1500); });
    syncSocket.addEventListener('error', () => syncSocket.close());
  }
  function publish(state) { sendSync({type:'state', room:roomCode, payload:state}); }
  function updateScreenStatus(connected = true) { const status=$('#syncStatus');if(!status)return;const unavailable=!syncAvailable||!connected;const message=unavailable?(location.hostname.endsWith('.github.io')?'GitHub Pages · сервер нужен':'Нет связи'):screenCount?'Экран подключён':'Экран не подключён';status.innerHTML=`${unavailable?'○':'●'} ${message}`;status.classList.toggle('is-online',screenCount>0&&!unavailable); }
  function screenToolbar() { return `<div class="screen-tools"><span class="sync-status" id="syncStatus">● Подключаемся…</span><button class="soft-button" id="openDisplay">Подключить экран</button><button class="soft-button" id="copyDisplay">Скопировать ссылку</button><span class="screen-instruction">Откройте ссылку на проекторе или втором устройстве</span></div>`; }
  function bindScreenTools() {
    updateScreenStatus();
    $('#openDisplay')?.addEventListener('click', () => { const win = window.open(displayUrl, 'winter-game-screen'); if (!win) notify('Разрешите всплывающее окно или откройте ссылку на экране.'); });
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
      <div class="score-strip">${state.names.map((name,i)=>`<label class="score-chip ${i===state.active?'active':''}"><span class="pawn-preview">${isCroc?`<i class="croc-pawn-token" style="--pawn-color:${crocPawnChoices.find(p=>p.id===state.pawns[i])?.color||'#2586cc'}">♟</i>`:state.pawns[i]}</span><input class="player-name" data-name="${i}" value="${escapeHtml(name)}" maxlength="16" aria-label="Название ${state.mode==='teams'?'команды':'игрока'} ${i+1}"><select class="pawn-choice" data-pawn="${i}" aria-label="Фишка ${i+1}">${choices.map(p=>{const value=isCroc?p.id:p;return `<option value="${value}" ${state.pawns[i]===value?'selected':''}>${isCroc?p.name:p}</option>`}).join('')}</select><b title="${isCroc?'Позиция на дорожке':'Очки'}">${isCroc?`${state.track?.[i]||0}/29`:state.scores[i] ?? 0}</b></label>`).join('')}</div>`;
  }
  function createContest(mode='solo', count=1) { return {mode, names:Array.from({length:count},(_,i)=>mode==='teams'?`Команда ${i+1}`:`Игрок ${i+1}`), scores:Array(count).fill(0), pawns:Array.from({length:count},(_,i)=>pawnChoices[i%pawnChoices.length]), active:0}; }
  function bindContest(state, rerender) {
    $('#contestMode')?.addEventListener('change', e => { state.mode = e.target.value; const count=Number($('#contestCount')?.value || 1); Object.assign(state, createContest(state.mode,count)); if(state===crocState){state.pawns=state.names.map((_,i)=>crocPawnChoices[i%6].id);state.track=Array(count).fill(0);state.active=Math.floor(Math.random()*count);state.roundBlocked={};state.turnsInRound=0;} rerender(); });
    $('#contestCount')?.addEventListener('change', e => { const next = createContest(state.mode,Number(e.target.value)); state.names=next.names; state.scores=next.scores; state.pawns=state===crocState?state.names.map((_,i)=>crocPawnChoices[i%6].id):next.pawns; state.active=0; if(state===crocState){state.track=Array(state.names.length).fill(0);state.active=Math.floor(Math.random()*state.names.length);state.roundBlocked={};state.turnsInRound=0;} rerender(); });
    document.querySelectorAll('.player-name').forEach(input => input.addEventListener('input', () => { state.names[Number(input.dataset.name)] = input.value; if (state===memoryState) publishMemo(); else if (state===quizState) publishQuiz(); else if (state===guessState) publishGuess(state.screenVisible); }));
    document.querySelectorAll('.pawn-choice').forEach(input => input.addEventListener('change', () => { state.pawns[Number(input.dataset.pawn)] = input.value; if (state===crocState) renderCroc(); else if (state===memoryState) publishMemo(); else if (state===quizState) publishQuiz(); else if (state===guessState) publishGuess(state.screenVisible); }));
  }
  function commonFrame(title, kicker, description, gameClass) {
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
    content.className=`modal-content ${gameClass || ''}`;
    content.innerHTML=`<div class="game-topbar"><button class="back-game" id="backHome">← Все игры</button><div class="full-brand">❄ СНЕЖНЫЙ ПЕРЕПОЛОХ</div><button class="fullscreen-control" id="goFullscreen">На весь экран ⛶</button></div><div class="modal-heading"><div class="section-kicker">${kicker}</div><h2 id="modalTitle">${title}</h2><p>${description}</p></div>${screenToolbar()}<div id="gameBody"></div>`;
    $('#backHome').addEventListener('click', closeGame);
    bindScreenTools();
    return $('#gameBody');
  }
  function closeGame() { if (memoryState?.timer) clearInterval(memoryState.timer); if (crocState?.timer) clearInterval(crocState.timer); publish({game:'idle',revealed:false,instruction:'Выберите игру на главном экране.'}); modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  function openGame(kind) {
    if (memoryState?.timer) clearInterval(memoryState.timer);
    if (crocState?.timer) clearInterval(crocState.timer);
    if (kind==='memo') { memoryState={...createContest(),pairs:12,deckId:'illustrated',extraMode:'classic',questionQueue:shuffle(memoQuestions.map((_,i)=>i)),questionCursor:0,lastQuestionIndex:null,factQueue:shuffle(memoFacts.map((_,i)=>i)),factCursor:0,lastFactIndex:null,pendingEvent:null,moves:0,seconds:0,deck:[],opened:[],matched:[],locked:false,timer:null,started:false}; renderMemo(); }
    if (kind==='guess') { guessState={...createContest(),playMode:'forehead',index:Math.floor(Math.random()*guessDeck.length),visible:false,screenVisible:false,asked:0,circlePlayers:[],activePlayerId:'',round:1}; renderGuess(); }
    if (kind==='croc') { const drawPile=shuffle(Array.from({length:100},(_,i)=>i)); crocState={...createContest(),pawns:crocPawnChoices.map(p=>p.id),card:drawPile.shift(),task:0,seconds:60,remaining:60,timer:null,track:Array(1).fill(0),scores:Array(1).fill(0),drawPile,discardPile:[],roundBlocked:{},round:1,turnsInRound:0,revealed:false,finished:false}; renderCroc(); }
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
      const tile=document.createElement('button');tile.type='button';tile.className=`memory-tile card-style-${card.design??0}`;tile.setAttribute('aria-label',`Закрытая карточка ${index+1}`);
      tile.innerHTML=`<span class="memory-back-mark"><i>✦</i><b>${s.deckId==='photo'?'✺':'❄'}</b><i>✦</i><small>${s.deckId==='photo'?'НОВОГОДНЯЯ ФОТОКОЛЛЕКЦИЯ':'СНЕЖНЫЙ ПЕРЕПОЛОХ'}</small></span><span class="memory-face"><span class="memory-face-top"><i>${s.deckId==='photo'?'НОВОГОДНЯЯ ФОТОКОЛЛЕКЦИЯ':'СНЕЖНЫЕ ИЛЛЮСТРАЦИИ'}</i><b>${String(card.pair+1).padStart(2,'0')}</b></span><span class="memory-card-art">${card.image?`<img src="${card.image}" alt="${escapeHtml(card.name)}">`:`<span class="memory-emoji">${card.emoji}</span>`}</span><span class="memory-name">${escapeHtml(card.name)}</span><span class="memory-face-snow">✦　❄　✦</span></span>`;
      tile.addEventListener('click',()=>flipMemo(index));grid.appendChild(tile);
    });
    const pairInput=$('#pairCount'),deckSelect=$('#memoDeck');
    deckSelect.addEventListener('change',()=>{const limit=deckSelect.value==='photo'?photoMemoryDeck.length:memoryDeck.length;pairInput.max=String(limit);pairInput.value=String(Math.min(Number(pairInput.value)||12,limit));});
    $('#memoApply').addEventListener('click',()=>{s.deckId=deckSelect.value;s.extraMode=$('#memoExtraMode').value;const limit=s.deckId==='photo'?photoMemoryDeck.length:memoryDeck.length;s.pairs=Math.max(2,Math.min(limit,Number(pairInput.value)||12));renderMemo();});
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
    s.opened.push(index);const tile=$('#memoryGrid').children[index];tile.classList.add('revealed');tile.setAttribute('aria-label',s.deck[index].name);
    if(s.opened.length<2){publishMemo();return;}
    s.moves++;$('#memoMoves').textContent=s.moves;const [a,b]=s.opened;
    if(s.deck[a].pair===s.deck[b].pair){
      s.matched.push(a,b);s.opened=[];$('#memoryGrid').children[a].classList.add('matched');$('#memoryGrid').children[b].classList.add('matched');s.scores[s.active]++;refreshMemoScores();
      if(s.extraMode==='questions'){s.pendingEvent={type:'question',item:takeMemoQuestion(),answered:false,bonus:2};s.locked=true;renderMemoEvent();}
      else if(s.extraMode==='facts'&&(s.matched.length/2)%2===0){s.pendingEvent={type:'fact',item:takeMemoFact()};s.locked=true;renderMemoEvent();}
      checkMemoFinished();publishMemo();
    }else{
      s.locked=true;s.active=(s.active+1)%s.names.length;publishMemo();setTimeout(()=>{if(!$('#memoryGrid'))return;$('#memoryGrid').children[a].classList.remove('revealed');$('#memoryGrid').children[b].classList.remove('revealed');s.opened=[];s.locked=false;refreshMemoScores();publishMemo();},850);refreshMemoScores();
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
    const old=guessState.circlePlayers||[];
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
    if(!guessState.circlePlayers.some(player=>player.id===guessState.activePlayerId)) guessState.activePlayerId=guessState.circlePlayers[0]?.id||'';
    renderGuess();
  }
  function renderGuess() {
    const s=guessState;
    const isCircle=s.playMode==='circle';
    const description=isCircle?'Все подключаются телефонами: у каждого своя карточка, скрытая на его ходу. Остальные участники видят её и помогают вопросами.':'Участник стоит спиной к общему экрану, остальные видят карточку и отвечают на вопросы «да» или «нет».';
    const body=commonFrame('Новогодние тарантинки','КТО ТЫ? УЗНАЙ С ПОМОЩЬЮ ВОПРОСОВ',description,'guess-screen');
    const card=guessDeck[s.index];
    const picker=`<section class="card-choice"><div class="picker-title">ВЫБЕРИ ОДНУ ИЗ ${guessDeck.length} КАРТОЧЕК</div><div class="guess-picker">${guessDeck.map((item,i)=>`<button class="guess-pick card-style-${item.design} ${i===s.index?'selected':''}" data-guess="${i}" title="${escapeHtml(item.name)}"><span class="guess-pick-number">${String(i+1).padStart(2,'0')}</span><span class="guess-pick-season">НОВЫЙ ГОД</span><span class="guess-pick-art">${item.image?`<img src="${item.image}" alt="">`:item.emoji}</span><span class="guess-pick-name">${escapeHtml(item.name)}</span><span class="guess-pick-flourish">✦ ❄ ✦</span></button>`).join('')}</div><button class="soft-button" id="guessRandom">Случайная карточка ✨</button></section>`;
    body.innerHTML=`${guessModeMarkup()}${isCircle?renderGuessCircleMarkup():`${contestMarkup(s)}<div class="guess-layout"><section class="guess-panel"><div class="guess-box"><div class="guess-label">КАРТОЧКА ${String(s.index+1).padStart(2,'0')} · СЛОВО ДЛЯ ОСТАЛЬНЫХ</div><div class="secret-card card-style-${card.design}"><span class="secret-card-label">НОВОГОДНЯЯ КАРТОЧКА · ${String(s.index+1).padStart(2,'0')}</span>${s.visible?`<span class="secret-emoji">${card.image?`<img src="${card.image}" alt="${escapeHtml(card.name)}">`:card.emoji}</span><span class="secret-word">${escapeHtml(card.name)}</span>`:'<span class="secret-hidden">?</span>'}</div><p class="guess-hint">${s.visible?`Подсказка ведущему: ${escapeHtml(card.hint1)}<br>${escapeHtml(card.hint2)}`:'Участник становится спиной к общему экрану. Остальные видят карточку и задают наводящие вопросы.'}</p><div class="guess-actions"><button class="solid-button" id="guessScreen">${s.screenVisible?'Скрыть с экрана':'Показать слово на экране'}</button><button class="soft-button" id="guessLocal">${s.visible?'Скрыть слово на устройстве':'Показать ведущему'}</button><button class="soft-button" id="guessQuestion">Вопрос задан · ${s.asked}</button><button class="soft-button" id="guessCorrect">Угадали! +1 🎉</button></div></div><div class="guess-caption">Участник у доски задаёт вопросы, пока не догадается, кто он или что он.</div></section>${picker}</div>`}`;
    body.querySelectorAll('[data-guess-mode]').forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.guessMode;if(mode!==s.playMode){s.playMode=mode;if(mode==='circle')syncCirclePlayers(connectedPlayers);else renderGuess();}}));
    if(isCircle){bindGuessCircle();publishGuessCircle();return;}
    bindContest(s,renderGuess);
    $('#guessScreen').addEventListener('click',()=>{s.screenVisible=!s.screenVisible;renderGuess();publishGuess(s.screenVisible);});
    $('#guessLocal').addEventListener('click',()=>{s.visible=!s.visible;renderGuess();});
    $('#guessQuestion').addEventListener('click',()=>{s.asked++;renderGuess();});
    $('#guessCorrect').addEventListener('click',()=>{s.scores[s.active]++;s.active=(s.active+1)%s.names.length;s.index=randomOther(guessDeck.length,s.index);s.visible=false;s.screenVisible=false;s.asked=0;renderGuess();publishGuess(false);notify('Отлично угадано! Теперь очередь следующего игрока.');});
    document.querySelectorAll('[data-guess]').forEach(button=>button.addEventListener('click',()=>{s.index=Number(button.dataset.guess);s.visible=false;s.screenVisible=false;s.asked=0;renderGuess();publishGuess(false);}));
    $('#guessRandom').addEventListener('click',()=>{s.index=randomOther(guessDeck.length,s.index);s.visible=false;s.screenVisible=false;s.asked=0;renderGuess();publishGuess(false);});
    publishGuess(s.screenVisible);
  }
  function renderGuessCircleMarkup(){
    const s=guessState,players=s.circlePlayers||[],active=players.find(player=>player.id===s.activePlayerId);
    const inviteUrl=appPageUrl(`player.html?room=${roomCode}`);
    const rows=players.length?players.map((player,index)=>`<div class="circle-player ${player.id===s.activePlayerId?'is-active':''}"><span class="circle-player-number">${index+1}</span><b>${escapeHtml(player.name)}</b><span class="circle-turn">${player.id===s.activePlayerId?'УГАДЫВАЕТ':'В КРУГУ'}</span><strong>${player.score||0} ★</strong></div>`).join(''):'<div class="circle-empty">Пока никто не подключился. Покажи QR или отправь адрес вместе с кодом комнаты.</div>';
    return `<div class="guess-circle-layout"><section class="circle-host-panel"><div class="circle-round-label">ТЕЛЕФОННЫЙ КРУГ · РАУНД ${s.round||1}</div><h3>${active?`${escapeHtml(active.name)} угадывает`: 'Подключи участников'}</h3><p>${active?'Остальные участники откроют его или её карточку на своих телефонах. Угадывающий видит только экран «не подглядывай».':'Игроки вводят имена и получают случайные зимние карточки. Для локальной игры подключите устройства к одной Wi-Fi сети.'}</p><div class="local-join-box"><div class="local-qr-wrap"><img id="playerInviteQr" alt="QR-код входа в телефонный круг" hidden><div id="localQrPlaceholder">❄</div></div><div class="local-join-details"><b id="localInviteTitle">Подключение по QR-коду</b><p id="localInviteHint">Проверяю адрес локальной сети…</p><div class="circle-invite"><span id="playerInviteUrl">${escapeHtml(inviteUrl)}</span><button class="soft-button" id="copyPlayerLink">Скопировать ссылку</button></div><div class="local-room-code">КОД КОМНАТЫ <strong>${roomCode}</strong><small>Можно ввести вручную после открытия страницы на телефоне</small></div></div></div><div class="circle-join-status">${players.length} ${players.length===1?'УЧАСТНИК ПОДКЛЮЧЁН':players.length>1?'УЧАСТНИКА ПОДКЛЮЧЕНО':'УЧАСТНИКОВ ПОДКЛЮЧЕНО'} · КОД ${roomCode}</div><div class="circle-player-list">${rows}</div><div class="circle-host-actions"><button class="solid-button" id="circleCorrect" ${!active?'disabled':''}>Угадал! +1 🎉</button><button class="soft-button" id="circlePass" ${!active?'disabled':''}>Пас · следующий участник →</button><button class="soft-button" id="circleNewRound" ${!players.length?'disabled':''}>Новый круг ↻</button></div><p class="circle-safety-note">Все телефоны должны быть в той же Wi-Fi сети, что и компьютер ведущего. Компьютер с игрой должен оставаться включён.</p></section><aside class="circle-phone-preview"><div class="phone-preview-frame"><div class="phone-preview-speaker"></div><div class="phone-preview-snow">❄</div><b>${active?'ТВОЯ ОЧЕРЕДЬ':'ЖДЁМ ИГРОКОВ'}</b><span>${active?'На своём ходу участник не увидит свою карточку.':'Телефон каждого участника покажет личную карточку.'}</span><div class="phone-preview-dots">●　●　●</div></div><div class="picker-title">КАРТОЧКИ НАЗНАЧАЮТСЯ ЛИЧНО</div></aside></div>`;
  }
  async function setupPlayerInvite(){
    const hint=$('#localInviteHint'),image=$('#playerInviteQr'),placeholder=$('#localQrPlaceholder'),urlLabel=$('#playerInviteUrl'),title=$('#localInviteTitle');
    if(!hint||!image)return;
    try{
      await shareOriginReady;
      if(!localAddressAvailable&&['localhost','127.0.0.1','::1'].includes(location.hostname))throw new Error('No local network address found');
      const response=await fetch('/api/qr.svg?text='+encodeURIComponent(appPageUrl(`player.html?room=${roomCode}`)),{cache:'no-store'});
      if(!response.ok)throw new Error('QR service unavailable');
      image.src=`/api/qr.svg?text=${encodeURIComponent(appPageUrl(`player.html?room=${roomCode}`))}`;image.hidden=false;if(placeholder)placeholder.hidden=true;
      if(urlLabel)urlLabel.textContent=appPageUrl(`player.html?room=${roomCode}`);
      title.textContent='Сканируй QR-код, чтобы войти';
      hint.textContent='Телефон откроет страницу участника. Устройства должны быть в одной Wi-Fi сети.';
    }catch{
      title.textContent=location.hostname.endsWith('.github.io')?'Запусти локальную игру для телефонного режима':'Локальный QR пока недоступен';
      hint.textContent=location.hostname.endsWith('.github.io')?'GitHub Pages подходит для одиночной игры. Для телефонов запусти Node.js-сервер на компьютере ведущего и открой его локальный адрес.':!localAddressAvailable?'Подключи компьютер к Wi-Fi и открой игру по локальному IP-адресу — тогда появится QR для телефонов.':'Телефонный режим требует локального Node.js-сервера с WebSocket; проверь, что сервер запущен и устройства в одной Wi-Fi сети.';
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
    publish({game:'guess',guessMode:'circle',revealed:false,gameLabel:'НОВОГОДНИЕ ТАРАНТИНКИ',word:'',emoji:'',image:'',mode:`РАУНД ${s.round||1}`,team:active?.name||'',activePlayerId:s.activePlayerId||'',round:s.round||1,circleCards:players.map(player=>({id:player.id,name:player.name,word:player.card.name,emoji:player.card.emoji,image:player.card.image,style:player.card.design,hint:`${player.card.hint1} ${player.card.hint2}`})),instruction:'Участники смотрят карточки на телефонах. Активный игрок не видит собственную подсказку.'});
  }

  const methodTexts=[
    {name:'Объясни словами',icon:'💬',hint:'Объясни слово словами, не называя его и не используя однокоренные слова.'},
    {name:'Напой',icon:'🎵',hint:'Напой песню или мелодию, чтобы команда догадалась. Не произноси загаданное слово.'},
    {name:'Покажи',icon:'👣',hint:'Покажи слово жестами, мимикой и движениями — без слов и звуков.'},
    {name:'Нарисуй',icon:'🎨',hint:'Нарисуй подсказку на бумаге. Не пиши буквы и цифры.'},
    {name:'Задавай вопросы',icon:'❔',hint:'Помоги команде вопросами, на которые можно ответить «да» или «нет».'}
  ];
  function cardTasks(cardIndex){return Array.from({length:5},(_,slot)=>{const prompt=prompts[(cardIndex*37+slot*19)%prompts.length];const method=methodTexts[slot];return{...prompt,method};});}
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
  function renderCroc() {
    const s=crocState,tasks=cardTasks(s.card),task=tasks[s.task];
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
      return `<button class="croc-task ${i===s.task?'selected':''} ${blocked?'round-blocked':''}" data-task="${i}" ${blocked?'disabled':''}><span class="task-number">${i+1}</span><span class="task-icon">${item.method.icon}</span><span class="task-description"><b>${escapeHtml(item.word)}</b><small>${item.method.name} · ${blocked?'уже не выбирается в этом раунде':`ход на ${i+1} клет${i===0?'ку':i<4?'ки':'ок'}`}</small></span><span class="task-arrow">${i===s.task?'●':'›'}</span></button>`;
    }).join('');
    const progress=s.track.map(pos=>`${pos}/29`).join(' · ');
    body.innerHTML=`${contestMarkup(s)}<div class="croc-layout"><section class="croc-main"><div class="croc-active-card"><div class="croc-card-top"><span class="card-label">КАРТА ${String(s.card+1).padStart(2,'0')} / 100</span><span class="croc-card-back-mark">❄</span></div><div class="croc-card-header"><span class="croc-card-question">?</span><div><b>Верхняя карта колоды</b><small>Выберите слово и способ объяснения</small></div></div><div class="task-mode">${task.method.icon} ${task.method.name} · СЛОВО ${s.task+1}</div><div class="croc-word-art">${task.emoji}</div><div class="current-word ${s.revealed?'visible':''}">${s.revealed?escapeHtml(task.word):'Слово скрыто'}</div><p class="task-hint">${s.revealed?escapeHtml(task.method.hint):'Слово видно только ведущему. Для участников используйте отдельный экран.'}</p><div class="timer-line"><span class="hourglass-label">⏳ Песочные часы · 60 секунд</span><span id="crocTimer" class="timer-display">${fmtTime(s.remaining)}</span><button id="timerStart" class="soft-button">${s.timer?'Пауза':'Перевернуть часы'}</button></div><div class="task-actions"><button class="solid-button" id="crocShow">${s.revealed?'Слово открыто':'Показать слово ведущему'}</button><button class="soft-button" id="crocScreen">${screenCount?'Показать участникам':'На экран участникам'}</button><button class="soft-button" id="crocCorrect">Угадали ✓</button><button class="soft-button" id="crocSkip">Не угадали ↻</button></div></div>${s.finished?`<div class="win-panel croc-win">🏁 ${escapeHtml(s.names[s.active])} достигает финиша и побеждает! <button class="soft-button" id="crocAgain">Новая партия</button></div>`:''}<div class="board-wrap"><div class="board-heading"><b>Игровое поле</b><span>Раунд ${s.round} · позиции: ${progress}</span></div><div class="board-track">${board}</div></div></section><aside class="croc-side"><div class="side-title">ЛИЦЕВАЯ СТОРОНА КАРТЫ · 5 СЛОВ</div><div class="task-list">${cardRows}</div><div class="deck-status"><span>🂠 В колоде <b>${s.drawPile.length}</b></span><span>♻ В сбросе <b>${s.discardPile.length}</b></span></div><div class="components-note"><b>Комплект по референсу:</b><br>6 цветных фишек · 100 карточек по 5 слов · песочные часы на 60 секунд · поле с дорожкой от старта до финиша.</div><details class="croc-rules"><summary>Правила игры</summary><p>Разделитесь на команды по 2–3 человека, выберите фишки и жребием определите первый ход. В свой ход игрок команды берёт верхнюю карту, выбирает одно из пяти слов и объясняет его указанным способом, пока пересыпается песок. Если слово угадали, команда двигается вперёд на столько клеток, под каким номером было слово; карта отправляется в сброс. Если не угадали, фишка остаётся на месте, а карта возвращается вниз колоды. В этом раунде нельзя повторно выбирать слово, которое уже не удалось объяснить, но можно выбрать другие слова с этой карты. После хода очередь переходит по часовой стрелке. Побеждает команда, первой достигшая финиша.</p></details></aside></div>`;
    bindContest(s,()=>{if(s.timer)clearInterval(s.timer);s.timer=null;s.remaining=60;s.finished=false;s.roundBlocked={};s.turnsInRound=0;renderCroc();});
    if(s.finished){['#crocShow','#crocScreen','#timerStart','#crocCorrect','#crocSkip'].forEach(id=>{const el=$(id);if(el)el.disabled=true;});document.querySelectorAll('[data-task]').forEach(el=>el.disabled=true);$('#crocAgain').addEventListener('click',()=>{if(s.timer)clearInterval(s.timer);s.timer=null;s.scores=Array(s.names.length).fill(0);s.track=Array(s.names.length).fill(0);s.active=Math.floor(Math.random()*s.names.length);s.round=1;s.turnsInRound=0;s.roundBlocked={};s.drawPile=shuffle(Array.from({length:100},(_,i)=>i));s.discardPile=[];s.card=s.drawPile.shift();s.task=0;s.finished=false;s.remaining=60;s.revealed=false;renderCroc();});}
    $('#crocShow').addEventListener('click',()=>{s.revealed=!s.revealed;renderCroc();publishCroc(s.revealed);});
    $('#crocScreen').addEventListener('click',()=>{s.revealed=true;renderCroc();publishCroc(true);notify('Слово выведено на отдельный экран.');});
    $('#timerStart').addEventListener('click',toggleCrocTimer);
    $('#crocCorrect').addEventListener('click',()=>completeCrocTask(true));
    $('#crocSkip').addEventListener('click',()=>completeCrocTask(false));
    document.querySelectorAll('[data-task]').forEach(button=>button.addEventListener('click',()=>{if(button.disabled)return;if(s.timer)clearInterval(s.timer);s.timer=null;s.task=Number(button.dataset.task);s.revealed=false;s.remaining=60;renderCroc();publishCroc(false);}));
    publishCroc(s.revealed);
  }
  function completeCrocTask(correct,timedOut=false){
    const s=crocState;if(s.timer)clearInterval(s.timer);s.timer=null;
    const card=s.card,slot=s.task,word=activeTask().word;
    if(correct){s.discardPile.push(card);s.track[s.active]=Math.min(29,s.track[s.active]+slot+1);s.scores[s.active]=s.track[s.active];if(s.track[s.active]>=29){s.finished=true;notify(`Финиш! ${s.names[s.active]} выигрывает!`);}}
    else{const blocked=s.roundBlocked[card]||(s.roundBlocked[card]=[]);if(!blocked.includes(slot))blocked.push(slot);s.drawPile.push(card);notify(timedOut?'Время вышло: фишка остаётся на месте, а слово закрывается до конца раунда.':`Слово «${word}» нельзя выбирать повторно в этом раунде.`);}
    if(!s.finished){advanceCrocTurn(s);const next=drawNextCrocCard(s);if(next<0){s.finished=true;notify('В колоде не осталось доступных слов.');}else{s.card=next;s.task=availableTasks(next)[0];}}
    s.remaining=60;s.revealed=false;renderCroc();publishCroc(false);
  }
  function toggleCrocTimer(){const s=crocState;if(s.timer){clearInterval(s.timer);s.timer=null;renderCroc();return;}if(!s.remaining){completeCrocTask(false,true);return;}s.timer=setInterval(()=>{s.remaining--;const t=$('#crocTimer');if(t){t.textContent=fmtTime(s.remaining);t.classList.toggle('urgent',s.remaining<=10);}publishCroc(s.revealed);if(s.remaining<=0){clearInterval(s.timer);s.timer=null;completeCrocTask(false,true);}},1000);$('#timerStart').textContent='Пауза';}
  function publishCroc(revealed){const task=activeTask();publish({game:'croc',revealed,gameLabel:'НОВОГОДНИЙ СУПЕРКРОКОДИЛ',word:task.word,emoji:task.emoji,mode:`${task.method.icon} ${task.method.name.toUpperCase()}`,team:crocState.names[crocState.active],instruction:task.method.hint,timer:crocState.remaining});}

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
      {title:'Новогодние песни для детей',url:'https://www.youtube.com/playlist?list=PLcY6sOZibNcaRr56chAwlp_EXUuevSmxL',kind:'Спокойные знакомые песни'}
    ],
    internationalPlaylists:[
      {title:'Christmas Karaoke Classics · Sing King',url:'https://www.youtube.com/playlist?list=PL8D4Iby0Bmm8OmcAYdZxiDl5igLVwFQ1J',kind:'Last Christmas, Santa Tell Me и другие хиты'},
      {title:'International Christmas Songs',url:'https://www.youtube.com/playlist?list=PLbZapce87T0eV_C4t_08WNYP2UrHr_q-E',kind:'Песни на разных языках'},
      {title:'Старые рождественские песни и джазовая классика',url:'https://www.youtube.com/playlist?list=PLK32o61rCfWHCOhi5AqIPqSlLX0Q3zTLK',kind:'Винтажная музыка для праздничного вечера'},
      {title:'Новогодние хиты и песни',url:'https://www.youtube.com/playlist?list=PL9Sagspadk-4pJwDSuNpPJQ63JF9NWPe0',kind:'Праздничный плейлист'}
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
    const lists=[['СЕМЕЙНОЕ КАРАОКЕ',crosswordMusic.familyKaraoke],['ЗАРУБЕЖНЫЕ ХИТЫ · КАРАОКЕ',crosswordMusic.worldKaraoke],['РУССКИЕ ПЛЕЙЛИСТЫ',crosswordMusic.russianPlaylists],['ЗАРУБЕЖНОЕ И КЛАССИКА',crosswordMusic.internationalPlaylists]];
    return `<section class="crossword-music"><div class="crossword-music-head"><span>🎶</span><div><b>Музыкальная пауза</b><small>Семейные песни, зарубежные хиты и классика · ссылки откроются на YouTube</small></div></div><div class="crossword-music-columns">${lists.map(([heading,items])=>`<div class="crossword-music-group"><h4>${heading}</h4>${items.map(item=>`<a class="crossword-music-link" href="${item.url}" target="_blank" rel="noopener noreferrer"><span class="music-play">▶</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.kind)}</small></span><i>↗</i></a>`).join('')}</div>`).join('')}</div></section>`;
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
    body.innerHTML=`<nav class="crossword-puzzle-nav" aria-label="Выбор кроссворда">${puzzleNav}</nav><div class="crossword-meta"><div><span class="crossword-difficulty">${escapeHtml(puzzle.difficulty)}</span><h3>${escapeHtml(puzzle.title)}</h3><p>${escapeHtml(puzzle.note)}</p></div><span class="crossword-word-count">${puzzle.entries.length} слов<br><b>${layout.rows} × ${layout.cols}</b></span></div><div class="crossword-layout"><section class="crossword-board-panel"><div class="crossword-board-scroll"><div class="crossword-board" style="--crossword-cols:${layout.cols};--crossword-rows:${layout.rows}">${grid.join('')}</div></div><div class="crossword-actions"><button class="solid-button" id="crosswordCheck">Проверить</button><button class="soft-button" id="crosswordReveal">Показать ответы</button><button class="soft-button" id="crosswordClear">Очистить</button></div><div class="crossword-progress" id="crosswordProgress">Слово ${active.number} · ${active.direction==='across'?'по горизонтали':'по вертикали'}</div>${checkedSummary}</section><aside class="crossword-clue-panel"><div class="crossword-clue-section"><h4>ПО ГОРИЗОНТАЛИ <span>→</span></h4><div class="crossword-clues">${clueList('across')}</div></div><div class="crossword-clue-section"><h4>ПО ВЕРТИКАЛИ <span>↓</span></h4><div class="crossword-clues">${clueList('down')}</div></div></aside></div>${crosswordMusicMarkup()}`;
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
    body.innerHTML=`${contestMarkup(s)}<div class="quiz-toolbar"><div class="quiz-turn"><span class="turn-flake">❄</span><span>Сейчас отвечает: <b>${escapeHtml(s.names[s.active])}</b></span><span class="quiz-remain">Осталось ${questions.length-s.used.length} из 70</span>${s.used.length===0&&s.mode==='teams'&&s.names.length>1?'<span class="first-team-pill">Первый ход — по жребию</span>':''}</div><button class="soft-button" id="quizRaffle" ${s.finished?'disabled':''}>Жребий ↻</button><button class="soft-button quiz-end-button" id="quizEnd" ${s.finished||s.selected!==null?'disabled':''}>Завершить игру</button><details class="quiz-rules"><summary>Правила игры</summary><p>В PDF-версии играют две команды. Команды по очереди выбирают любую из 70 ячеек. За верный ответ — 1 балл и дополнительный ход; за ошибку — передача хода. Ведущий определяет правильность ответа. Завершить игру можно кнопкой «Завершить игру» на поле; если открыть все 70 вопросов, игра завершится автоматически. Побеждает команда с большим числом баллов. В личном режиме игроки отвечают по очереди.</p></details></div>${scoreSummary}${questionPanel}<div class="quiz-board-wrap"><div class="quiz-board-heading"><span>ИГРОВОЕ ПОЛЕ</span><small>Свободные вопросы можно выбирать в любом порядке</small></div><div class="quiz-board">${board}</div></div>`;
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
      const now=performance.now();if(now-lastSpawn<55)return;lastSpawn=now;
      const existing=layer.querySelectorAll('.cursor-snowflake');
      if(existing.length>66)existing[0].remove();
      const count=2+(Math.random()>.8?1:0);
      for(let i=0;i<count;i++){
        const flake=document.createElement('span');flake.className='cursor-snowflake';flake.textContent=['❄','❅','✧','·','✦'][Math.floor(Math.random()*5)];
        flake.style.color=['#fff','#effcff','#dff6ff','#f4f0ff'][Math.floor(Math.random()*4)];
        flake.style.left=`${event.clientX+(Math.random()*16-8)}px`;flake.style.top=`${event.clientY+(Math.random()*12-6)}px`;
        flake.style.fontSize=`${8+Math.random()*11}px`;flake.style.setProperty('--flake-drift',`${Math.random()*54-27}px`);
        flake.style.setProperty('--flake-spin',`${Math.random()*170-85}deg`);flake.style.setProperty('--flake-duration',`${650+Math.random()*550}ms`);
        flake.addEventListener('animationend',()=>flake.remove(),{once:true});layer.appendChild(flake);
      }
    },{passive:true});
  }
  makeSnow();connectSync();
  $('#snowToggle').addEventListener('click',()=>{const layer=$('.snow-layer');const on=layer.style.display!=='none';layer.style.display=on?'none':'block';$('#snowToggle').innerHTML=`${on?'☼':'❄'} <span>${on?'Снегопад выкл.':'Снег идёт'}</span>`;});
})();
