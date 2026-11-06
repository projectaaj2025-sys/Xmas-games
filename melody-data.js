// Названия из прежних четырёх туров. Аудиофайлы добавляет ведущий.
window.MELODY_SONGS = {
  "russian": [
    "Новогодняя",
    "Зима-холода",
    "С Новым Годом!",
    "Кабы не было зимы",
    "Пять минут",
    "Три белых коня",
    "Песенка о снежинке",
    "Звенит январская вьюга",
    "Песенка о медведях",
    "Снег идёт",
    "Новогодние игрушки",
    "Снег-снежок",
    "Это новый год",
    "Снегом стать",
    "Зима",
    "С Новым годом, Россия!",
    "Белая зима",
    "Белые снежинки",
    "Новогодняя песня",
    "Новый год",
    "Старый год",
    "Праздник к нам приходит",
    "Ёлочка",
    "В этот Новый год",
    "Новогодний поцелуй",
    "Снег падает",
    "Первый час января",
    "Заметёт зима",
    "Выходи играть в снежки",
    "Снег на Новый год",
    "Загадай желание",
    "Рождественская",
    "Маленькой ёлочке холодно зимой",
    "Расскажи, Снегурочка",
    "Новый год",
    "О мой год!"
],
  "international": [
    "All I Want for Christmas Is You",
    "Last Christmas",
    "Feliz Navidad",
    "Rockin' Around the Christmas Tree",
    "Jingle Bells",
    "Silent Night",
    "White Christmas",
    "It's the Most Wonderful Time of the Year",
    "The Christmas Song",
    "Santa Tell Me",
    "Driving Home for Christmas",
    "Happy Xmas (War Is Over)",
    "Wonderful Christmastime",
    "Merry Christmas Everyone",
    "Let It Snow! Let It Snow! Let It Snow!",
    "A Holly Jolly Christmas",
    "O Holy Night",
    "Deck the Halls",
    "Do They Know It’s Christmas?",
    "Fairytale of New York",
    "Christmas Lights",
    "Underneath the Tree",
    "Mistletoe",
    "Joy to the World",
    "Hark! The Herald Angels Sing",
    "God Rest Ye Merry, Gentlemen",
    "We Wish You a Merry Christmas",
    "Winter Wonderland",
    "Rudolph the Red-Nosed Reindeer",
    "Frosty the Snowman",
    "Carol of the Bells",
    "Mary Did You Know?",
    "Have Yourself a Merry Little Christmas",
    "I Saw Three Ships",
    "Away in a Manger",
    "Ding Dong Merrily on High"
  ]
};

// Short instrumental previews made from openly licensed MIDI arrangements.
window.MELODY_AUDIO = {
  'Jingle Bells': 'assets/melody/audio/jingle-bells.wav',
  'Silent Night': 'assets/melody/audio/silent-night.wav',
  'Deck the Halls': 'assets/melody/audio/deck-the-halls.wav',
  'Joy to the World': 'assets/melody/audio/joy-to-the-world.wav',
  'Hark! The Herald Angels Sing': 'assets/melody/audio/hark-the-herald-angels-sing.wav',
  'We Wish You a Merry Christmas': 'assets/melody/audio/we-wish-you-a-merry-christmas.wav',
  'Away in a Manger': 'assets/melody/audio/away-in-a-manger.wav'
};

// Official or artist-published recordings, played through YouTube's embedded player.
window.MELODY_YOUTUBE = {
  'Jingle Bells': 'hLf0-lro8X8',
  'Silent Night': 'moHobaO9TlM',
  'Deck the Halls': '8ZRe_44IVSo',
  'Joy to the World': 'V51esHTsCGU',
  'Hark! The Herald Angels Sing': 'xqooC4ZG75Y',
  'We Wish You a Merry Christmas': 'SNXWtunvyjg',
  'Away in a Manger': 'XhV07BlG0q0',
  'All I Want for Christmas Is You': 'yXQViqx6GMY',
  'Last Christmas': 'E8gmARGvPlI',
  'Feliz Navidad': 'SlNio1aclVI',
  "Rockin' Around the Christmas Tree": 'DSHGd4lmLd4',
  'White Christmas': 'v5ryZdpEHqM',
  "It's the Most Wonderful Time of the Year": '_ekT8idRRD8',
  'The Christmas Song': 'wKhRnZZ0cJI',
  'Santa Tell Me': 'jnXxxKZ57Tw',
  'Driving Home for Christmas': 'mkd1_S7g544',
  'Happy Xmas (War Is Over)': 'BA8-XtdxB2E',
  'Wonderful Christmastime': '3cr1EZQuwR8',
  'Merry Christmas Everyone': 'N-PyWfVkjZc',
  'Let It Snow! Let It Snow! Let It Snow!': 'Rnil5LyK_B0',
  'A Holly Jolly Christmas': 'P_dI6fVZwd0',
  'O Holy Night': 'c3Mnf87q9v8',
  'Do They Know It’s Christmas?': '2_P7RW6Mm5g',
  'Fairytale of New York': 'j9jbdgZidu8',
  'Christmas Lights': 'z1rYmzQ8C9Q',
  'Underneath the Tree': 'YfF10ow4YEo',
  'Mistletoe': 'LUjn3RpkcKY',
  'God Rest Ye Merry, Gentlemen': '-VxHdITRRmE',
  'Winter Wonderland': 'GP5_dJUd3BY',
  'Rudolph the Red-Nosed Reindeer': '17vAzrb_8vM',
  'Frosty the Snowman': 'bdEpPXVOmTA',
  'Carol of the Bells': '3ghQaoBjllg',
  'Mary Did You Know?': 'ifCWN5pJGIE',
  'Have Yourself a Merry Little Christmas': '-tJtsKngXJU',
  'I Saw Three Ships': 'GD7a0g9uODg',
  'Ding Dong Merrily on High': 'zJbRURK3zWo'
};

// Sources identify different recordings even when their titles coincide.
window.MELODY_RUSSIAN_SOURCES = [
  {
    "artist": "Дискотека Авария",
    "source": "https://rus.hitmos.fm/song/9293226",
    "youtube": "1-bxBXOE368"
  },
  {
    "artist": "Андрей Губин",
    "source": "https://rus.hitmos.fm/song/10097515",
    "youtube": "JnqKGDJD8gg"
  },
  {
    "artist": "Руки Вверх!",
    "source": "https://rus.hitmos.fm/song/10084841",
    "youtube": "QRopTjoZWSA"
  },
  {
    "artist": "Валентина Толкунова",
    "source": "https://rus.hitmos.fm/song/12586473",
    "youtube": null
  },
  {
    "artist": "Людмила Гурченко",
    "source": "https://rus.hitmos.fm/song/7716573",
    "youtube": null
  },
  {
    "artist": "Лариса Долина",
    "source": null,
    "youtube": "jWiKX6wE9fY"
  },
  {
    "artist": "Чародеи",
    "source": null,
    "youtube": "EaOu9c_WR7c"
  },
  {
    "artist": "Нина Бродская",
    "source": "https://rus.hitmos.fm/song/12586413",
    "youtube": "2QdBGUHV0uA"
  },
  {
    "artist": "Аида Ведищева",
    "source": "https://rus.hitmos.fm/song/12586443",
    "youtube": null
  },
  {
    "artist": "Глюкоза",
    "source": "https://rus.hitmos.fm/song/12540932",
    "youtube": "ruvZrmwlX8M"
  },
  {
    "artist": "Инна Маликова, Новые Самоцветы",
    "source": "https://rus.hitmos.fm/song/12586475",
    "youtube": null
  },
  {
    "artist": "Балаган Лимитед",
    "source": "https://rus.hitmos.fm/song/10737950",
    "youtube": null
  },
  {
    "artist": "Reflex",
    "source": "https://rus.hitmos.fm/song/10097526",
    "youtube": null
  },
  {
    "artist": "Силуянова",
    "source": "https://rus.hitmos.fm/song/10729667",
    "youtube": null
  },
  {
    "artist": "Инна Маликова и Новые Самоцветы",
    "source": "https://rus.hitmos.fm/song/10733860",
    "youtube": null
  },
  {
    "artist": "Ezziati",
    "source": "https://rus.hitmos.fm/song/11401566",
    "youtube": null
  },
  {
    "artist": "Александр Добронравов и Варвара",
    "source": "https://rus.hitmos.fm/song/12377175",
    "youtube": null
  },
  {
    "artist": "Детские Новогодние Песенки",
    "source": "https://rus.hitmos.fm/song/7388015",
    "youtube": null
  },
  {
    "artist": "Блестящие",
    "source": "https://rus.hitmos.fm/song/7310147",
    "youtube": null
  },
  {
    "artist": "Вирус",
    "source": "https://rus.hitmos.fm/song/8886634",
    "youtube": null
  },
  {
    "artist": "Валерий Меладзе",
    "source": "https://rus.hitmos.fm/song/9303584",
    "youtube": null
  },
  {
    "artist": "Клава Кока",
    "source": "https://rus.hitmos.fm/song/10071794",
    "youtube": "eptzcBeAOnk"
  },
  {
    "artist": "Балаган Лимитед",
    "source": "https://rus.hitmos.fm/song/10737949",
    "youtube": null
  },
  {
    "artist": "Sasha Ray",
    "source": "https://rus.hitmos.fm/song/10084837",
    "youtube": null
  },
  {
    "artist": "Чай Вдвоём",
    "source": "https://rus.hitmos.fm/song/7288668",
    "youtube": null
  },
  {
    "artist": "Марк Тишман",
    "source": "https://rus.hitmos.fm/song/12378128",
    "youtube": null
  },
  {
    "artist": "Алсу",
    "source": "https://rus.hitmos.fm/song/8265424",
    "youtube": null
  },
  {
    "artist": "Маргарита Позоян",
    "source": "https://rus.hitmos.fm/song/10090154",
    "youtube": null
  },
  {
    "artist": "The Hatters",
    "source": "https://rus.hitmos.fm/song/12374411",
    "youtube": null
  },
  {
    "artist": "Би-2",
    "source": "https://rus.hitmos.fm/song/12195592",
    "youtube": null
  },
  {
    "artist": "Мари Атлас",
    "source": "https://rus.hitmos.fm/song/11401557",
    "youtube": null
  },
  {
    "artist": "Жасмин",
    "source": "https://rus.hitmos.fm/song/7272601",
    "youtube": null
  },
  {
    "artist": "детская песня",
    "source": null,
    "youtube": "KCA3oUv1r4M"
  },
  {
    "artist": "Ну, погоди!",
    "source": null,
    "youtube": "NRdGSXPmn2s"
  },
  {
    "artist": "Стекловата",
    "source": null,
    "youtube": "3m4c5vnLh_E"
  },
  {
    "artist": "Олег Попков",
    "source": "https://rus.hitmos.fm/song/10737957",
    "youtube": null
  }
];
