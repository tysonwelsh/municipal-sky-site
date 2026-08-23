/* ============================================================================
   KIMI'S TAKE — a spin-off of The Carbon Rain (art/carbon-rain/), forked at
   its v0.1.3: same rain, no words. The two are meant to grow apart.

   The Matrix rain, re-run for the large-language-model era: 73 writing
   systems and five sets of notation, one glyph to a printed square, streaming
   along PATHS across a sheet of engineering paper — entering from every edge,
   running straight or turning corners — at different speeds, and never once
   overlapping.

   THE TRAFFIC IS SOLVED AT BIRTH, NOT ON THE ROAD. Streams glide smoothly at
   constant speed, but a glide along a fixed path at constant velocity is
   predictable: each stream's whole traverse is a closed-form set of (cell,
   time-interval) reservations, checked against every stream already booked
   before it is allowed to exist. No braking, no yielding, no gridlock — a
   stream that cannot find clear spacetime is simply not born this cycle, and
   the gap reads as weather. Births are dealt one per planner tick: bursts
   traverse in lockstep and the sheet waves; singletons never do. And the
   MIX is balanced by a ledger, not by hope: the planner tracks booked
   cell-seconds per axis and births whichever clear candidate most reduces
   the imbalance — a wide sheet would otherwise belong to the horizontals.

   THE COLUMN STILL NEVER REPEATS. A stream's glyphs are dealt when it is
   born and re-dealt only while it is entirely off the sheet — retirement is
   a fact about the clock, so it works in background tabs too. And the
   renderer writes positions computed from the same arithmetic as the
   bookings: no second clock, no engine-specific keyframe behaviour.

   The character pool is a COPY of the one in art/junk-drawer/junk-drawer.js,
   not a shared library — the two are meant to grow apart. If you change the
   pool here, that one does not follow.
   ========================================================================== */
(function () {
  'use strict';
  var POOL = {"lat":{"w":13,"s":10.0,"c":"ABCDEFGHIJKLMNOPQRSTUVWXYZ","n":"Latin"},"dig":{"w":7,"s":10.0,"c":"0123456789","n":"Digits"},"mrk":{"w":5,"s":10.0,"c":"/-.:§¶№×÷±°†‡¤¢£¥","n":"Marks"},"grk":{"w":6,"s":10.1,"c":"ͰͱͲͳͶͷͻͼͽͿΆΈΉΊΌΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώϏϐϑϒϓϔϕϖϗϘϙϚϛϜϝϞϟϠϡϢϣϤϥϦϧϨϩϪϫϬϭϮϯϰϱϲϳϴϵ϶ϷϸϹϺϻϼϾϿἀἁἂἃἄἅἆἇἈἉἊἋἌἍἎἏἐἑἒἓἔἕἘἙἚἛἜἝἠἡἢἣἤἥἦἧἨἩἪἫἬἭἮἯἰἱἲἳἴἵἶἷἸἹἺἻἼἽἾἿὀὁὂὃὄὅὈὉὊὋὌὍὐὑὒὓὔὕὖὗὙὛὝὟὠὡὢὣὤὥὦὧὨὩὪὫὬὭὮὯὰάὲέὴήὶίὸόὺύὼώᾀᾁᾂᾃᾄᾅᾆᾇᾈᾉᾊᾋᾌᾍᾎᾏᾐᾑᾒᾓᾔᾕᾖᾗᾘᾙᾚᾛᾜᾝᾞᾟᾠᾡᾢᾣᾤᾥᾦᾧᾨᾩᾪᾫᾬᾭᾮᾯᾰᾱᾲᾳᾴᾶᾷᾸᾹᾺΆᾼῂῃῄῆῇῈΈῊΉῌῐῑῒΐῖῗῘῙῚΊῠῡῢΰῤῥῦῧῨῩῪΎῬῲῳῴῶῷῸΌῺΏῼ","n":"Greek"},"cyr":{"w":6,"s":9.3,"c":"ЀЁЂЃЄЅІЇЈЉЊЋЌЍЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюяѐёђѓєѕіїјљњћќѝўџѠѡѢѣѤѥѦѧѨѩѪѫѬѭѮѯѰѱѲѳѴѵѶѷѸѹѺѻѼѽѾѿҀҁ҂ҊҋҌҍҎҏҐґҒғҔҕҖҗҘҙҚқҜҝҞҟҠҡҢңҤҥҦҧҨҩҪҫҬҭҮүҰұҲҳҴҵҶҷҸҹҺһҼҽҾҿӀӁӂӃӄӅӆӇӈӉӊӋӌӍӎӐӑӒӓӔӕӖӗӘәӚӛӜӝӞӟӠӡӢӣӤӥӦӧӨөӪӫӬӭӮӯӰӱӲӳӴӵӶӷӸӹӺӻӼӽӾӿԀԁԂԃԄԅԆԇԈԉԊԋԌԍԎԏԐԑԒԓԔԕԖԗԘԙԚԛԜԝԞԟԠԡԢԣԤԥԦԧԨԩԫԬԭԮԯꙀꙁꙂꙃꙄꙅꙆꙇꙈꙉꙊꙋꙌꙍꙎꙏꙐꙑꙒꙓꙔꙕꙖꙗꙘꙙꙚꙛꙜꙝꙞꙟꙠꙡꙢꙣꙤꙥꙦꙧꙨꙩꙪꙫꙬꙭꙮꙿꚀꚁꚂꚃꚆꚇꚈꚉꚊꚋꚌꚍꚎꚏꚐꚑꚒꚓꚔꚕꚖꚗꚘꚙꚚꚛ","n":"Cyrillic"},"heb":{"w":5,"s":10,"c":"אבגדהוזחטךכלםמןנסעףפץצקרשתװױײײַﬠﬡﬢﬣﬤﬥﬦﬧﬨ﬩שׁשׂשּׁשּׂאַאָאּבּגּדּהּוּזּטּךּכּלּמּנּסּףּפּצּקּרּשּתּוֹבֿכֿפֿﭏ","n":"Hebrew"},"arb":{"w":5,"s":9.9,"c":"ؠءآأؤإئبةتثجحخدذرزسشصضطظعغػؼؽؾؿفقكلمنهوىيٮٯٱٲٳٵٶٷٸٹٺٻټٽپٿڀځڂڃڄڅچڇڈډڊڋڌڍڎڏڐڑڒړڔڕږڗژڙښڛڜڝڞڟڠڡڢڣڤڥڦڧڨکڪګڬڭڮگڰڱڲڳڴڵڶڷڸڹںڻڼڽھڿۀہۂۃۄۅۆۇۈۉۊۋیۍێۏېۑےۓݐݑݒݓݔݕݖݗݘݙݚݛݜݝݞݟݠݡݢݣݤݥݦݧݨݩݪݫݬݭݮݯݰݱݲݳݴݵݶݷݸݹݺݻݼݽݾݿࢠࢡࢢࢣࢤࢥࢦࢧࢨࢩࢪࢫࢬࢮࢰࢱࢲࢳࢴࢵࢶࢷࢸࢹࢺࢻࢼࢽ","n":"Arabic"},"dev":{"w":5,"s":8.9,"c":"ऄअआइईउऊऋऌऍऎएऐऑऒओऔकखगघङचछजझञटठडढणतथदधनऩपफबभमयरऱलळऴवशषसहक़ख़ग़ज़ड़ढ़फ़य़ॠॡॲॳॴॵॶॷॸॹॺॻॼॽॾॿ","n":"Devanagari"},"geo":{"w":4,"s":9.7,"c":"ႠႡႢႣႤႥႦႧႨႩႪႫႬႭႮႯႰႱႲႳႴႵႶႷႸႹႺႻႼႽႾႿჀჁჂჃჄჅაბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰჱჲჳჴჵჶჷჸჹჺჼჽჾჿᲐᲑᲒᲓᲔᲕᲖᲗᲘᲙᲚᲛᲜᲝᲞᲟᲠᲡᲢᲣᲤᲥᲦᲧᲨᲩᲪᲫᲬᲭᲮᲯᲰᲱᲲᲳᲴᲵᲶᲷᲸᲹᲺᲽᲾᲿ","n":"Georgian"},"arm":{"w":4,"s":9.7,"c":"ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀՁՂՃՄՅՆՇՈՉՊՋՌՍՎՏՐՑՒՓՔՕՖՙաբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփքօֆև","n":"Armenian"},"cjk":{"w":4,"s":6,"c":"⼃⼨⽌⽰⾔⾸万丬乑乵亙亽仡伅伩位佱侕侹保倁倥偉偭傑債僙僽儡充兩再决凗击刟剃剧劋劯勓勷匛匿卣厇厫叏右吗吻呟咃咧哋哯唓唷啛啿喣嗇嗫嘏嘳噗噻嚟囃囧國圯坓坷垛垿埣堇堫塏塳増墻壟夃大奋奯妓妷姛姿娣婇婫媏媳嫗嫻嬟孃孧宋宯寓寷尛尿屣岇岫峏峳崗崻嵟嶃嶧巋巯帓帷幛广庣廇廫式弳彗彻徟心忧怋怯恓恷悛悿惣愇愫慏慳憗憻懟戃戧手扯抓抷招拿挣捇捫掏掳揗揻搟摃摧撋撯擓擷攛政散文斫族旳昗昻晟暃暧曋曯朓朷杛板枣柇柫栏栳桗桻梟棃棧椋椯楓楷榛榿槣樇樫橏橳檗檻櫟欃欧歋歯殓殷毛毿氣汇汫沏河泗泻洟浃浧涋涯淓混減渿湣溇溫滏滳漗漻潟澃澧濋濯瀓瀷灛灿炣烇烫焏焳煗煻熟燃燧爋爯牓牷犛犿狣猇猫獏獳玗玻珟球琧瑋瑯璓璷瓛瓿産畇畫疏疳痗痻瘟癃癧皋皯盓盷眛眿督瞇瞫矏石砗砻硟碃碧磋磯礓礷祛祿禣秇秫稏稳穗穻窟竃竧笋笯筓筷箛箿篣簇簫籏米粗粻糟紃紧絋絯經綷緛緿縣繇繫纏纳绗绻缟罃罧羋羯翓翷耛耿聣肇肫胏胳脗脻腟膃膧臋臯舓舷艛艿芣苇苫茏茳荗荻莟菃菧萋萯葓葷蒛蒿蓣蔇蔫蕏蕳薗薻藟蘃蘧虋虯蚓蚷蛛蛿蜣蝇蝫螏螳蟗蟻蠟衃衧袋袯裓裷褛褿襣覇覫觏觳託註詟誃誧請諯謓謷譛譿讣诇诫谏谳豗豻貟賃賧贋贯赓起趛趿跣踇踫蹏蹳躗躻軟較輧轋软输辷进迿連遇遫邏邳郗郻鄟酃酧醋醯釓釷鈛鈿鉣銇銫鋏鋳錗錻鍟鎃鎧鏋鏯鐓鐷鑛鑿钣铇铫锏锳镗镻閟闃闧阋阯陓陷際隿難震霫靏靳鞗鞻韟頃頧顋顯颓颷飛飿餣饇饫馏馳駗駻騟驃驧骋骯髓髷鬛鬿魣鮇鮫鯏鯳鰗鰻鱟鲃鲧鳋鳯鴓鴷鵛鵿鶣鷇鷫鸏鸳鹗鹻麟黃黧鼋鼯齓齷龛","n":"Chinese"},"han":{"w":4,"s":7.5,"c":"ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅢㅥㅦㅧㅨㅩㅪㅫㅬㅭㅮㅯㅰㅱㅲㅳㅴㅵㅶㅷㅸㅹㅺㅻㅼㅽㅾㅿㆀㆁㆂㆃㆄㆅㆆㆇㆈㆉㆊㆋㆌㆎ","n":"Hangul"},"tha":{"w":3,"s":10.1,"c":"กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮ","n":"Thai"},"che":{"w":6,"s":9.5,"c":"ᎠᎡᎢᎣᎤᎥᎦᎧᎨᎩᎪᎫᎬᎭᎮᎯᎰᎱᎲᎳᎴᎵᎶᎷᎸᎹᎺᎻᎼᎽᎾᎿᏀᏁᏂᏃᏄᏅᏆᏇᏈᏊᏋᏌᏍᏎᏏᏐᏑᏒᏓᏔᏕᏖᏗᏘᏙᏚᏛᏜᏝᏞᏟᏠᏡᏢᏣᏤᏥᏦᏧᏨᏩᏫᏬᏭᏮᏯᏰᏱᏲᏳᏴᏵꭰꭱꭲꭳꭴꭵꭶꭷꭸꭹꭺꭻꭼꭽꭾꭿꮀꮁꮂꮃꮄꮅꮆꮇꮈꮉꮊꮋꮌꮍꮎꮏꮐꮑꮒꮓꮔꮕꮖꮗꮘꮙꮚꮛꮜꮝꮞꮟꮠꮡꮢꮣꮤꮥꮦꮧꮨꮩꮪꮫꮬꮭꮮꮯꮰꮱꮲꮳꮴꮵꮶꮷꮸꮹꮺꮻꮼꮽꮾꮿ","n":"Cherokee"},"des":{"w":6,"s":10.3,"c":"𐐀𐐁𐐂𐐃𐐄𐐆𐐇𐐈𐐉𐐊𐐋𐐌𐐍𐐎𐐏𐐐𐐑𐐒𐐓𐐕𐐖𐐗𐐙𐐚𐐛𐐜𐐝𐐞𐐟𐐠𐐡𐐢𐐣𐐤𐐥𐐧𐐨𐐩𐐪𐐫𐐬𐐭𐐮𐐯𐐰𐐱𐐲𐐳𐐴𐐵𐐶𐐷𐐸𐐹𐐺𐐻𐐼𐐽𐐾𐐿𐑀𐑁𐑂𐑃𐑄𐑅𐑆𐑇𐑈𐑉𐑊𐑋𐑌𐑍𐑎𐑏","n":"Deseret"},"tib":{"w":5,"s":12,"c":"ཀཁགགྷངཅཆཇཉཊཋཌཌྷཎཏཐདདྷནཔཕབབྷམཙཚཛཛྷཝཞཟའཡརལཤཥསཧཨཀྵཪཫཬ","n":"Tibetan"},"brh":{"w":3,"s":9.6,"c":"𑀓𑀔𑀕𑀖𑀗𑀘𑀙𑀚𑀛𑀜𑀝𑀞𑀟𑀠𑀡𑀢𑀣𑀤𑀥𑀦𑀧𑀨𑀩𑀪𑀫𑀬𑀮𑀯𑀰𑀱𑀲𑀳𑀴𑀵𑀶𑀷","n":"Brahmi"},"sid":{"w":3,"s":8.3,"c":"𑖀𑖁𑖂𑖃𑖄𑖅𑖆𑖇𑖈𑖉𑖊𑖋𑖌𑖍𑖎𑖏𑖐𑖑𑖒𑖓𑖔𑖕𑖖𑖗𑖘𑖙𑖚𑖛𑖜𑖝𑖞𑖟𑖠𑖡𑖢𑖣𑖤𑖥𑖦𑖧𑖨𑖩𑖪𑖫𑖬𑖭𑖮","n":"Siddham"},"shr":{"w":3,"s":9.3,"c":"𑆃𑆄𑆅𑆆𑆇𑆈𑆉𑆊𑆋𑆌𑆍𑆎𑆏𑆐𑆑𑆒𑆓𑆔𑆕𑆖𑆗𑆘𑆙𑆚𑆛𑆜𑆝𑆞𑆟𑆠𑆡𑆢𑆣𑆤𑆥𑆦𑆧𑆨𑆩𑆪𑆫𑆬𑆭𑆮𑆯𑆰𑆱𑆲","n":"Sharada"},"gra":{"w":3,"s":6.8,"c":"𑌅𑌆𑌇𑌈𑌉𑌊𑌋𑌌𑌏𑌓𑌔𑌕𑌖𑌗𑌘𑌙𑌚𑌛𑌜𑌝𑌞𑌟𑌠𑌡𑌢𑌣𑌤𑌥𑌦𑌧𑌨𑌪𑌫𑌬𑌭𑌮𑌯𑌰𑌲𑌳𑌵𑌶𑌷𑌸𑌹","n":"Grantha"},"khr":{"w":3,"s":10,"c":"𐨀𐨐𐨑𐨒𐨓𐨕𐨖𐨗𐨙𐨚𐨛𐨜𐨝𐨞𐨟𐨠𐨡𐨢𐨣𐨤𐨥𐨦𐨧𐨨𐨩𐨪𐨫𐨬𐨭𐨮𐨯𐨰𐨱𐨲𐨳","n":"Kharoshthi"},"ben":{"w":2,"s":9,"c":"অইঈউঊঋঌএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহড়ঢ়য়","n":"Bengali"},"gur":{"w":2,"s":9.8,"c":"ਅਆਇਈਉਊਏਐਓਔਕਖਗਘਙਚਛਜਝਞਟਠਡਢਣਤਥਦਧਨਪਫਬਭਮਯਰਲਲ਼ਵਸ਼ਸਹਖ਼ਗ਼ਜ਼ੜਫ਼","n":"Gurmukhi"},"guj":{"w":2,"s":8.2,"c":"અઆઇઈઉઊઋઌઍએઐઓઔકખગઘઙચછજઝઞટઠડઢણતથદધનપફબભમયરલળવશષસહ","n":"Gujarati"},"ori":{"w":2,"s":9.1,"c":"ଅଆଇଈଉଊଋଌଏଐଓଔକଖଗଘଙଚଛଜଝଞଟଠଡଢଣତଥଦଧନପଫବଭମଯରଲଳଵଶଷସହ","n":"Odia"},"tam":{"w":2,"s":8.1,"c":"அஆஇஈஉஊஎஏஐஒஓகஙசஜஞடணதநனமயரறலளழவஶஷஸஹ","n":"Tamil"},"tel":{"w":2,"s":7.2,"c":"అఆఇఈఉఊఌఎఏఐఒఓఔకఖగఘఙచఛజఝఞటఠడఢణతథదధనపఫబభమయరఱలళఴవశషసహౘౙౚ","n":"Telugu"},"kan":{"w":2,"s":7.2,"c":"ಅಆಇಈಉಋಌಎಏಐಒಓಔಕಖಗಘಙಚಛಜಝಞಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಱಲಳವಶಷಸಹ","n":"Kannada"},"mal":{"w":2,"s":6.1,"c":"അആഇഈഉഊഋഌഎഏഐഒഓഔകഖഗഘങചഛജഝഞടഠഡഢണതഥദധനഩപഫബഭമയരറലളഴവശഷസഹൔൕൖ","n":"Malayalam"},"sin":{"w":2,"s":7.9,"c":"අආඇඈඉඊඋඌඍඏඐඑඒඓඔඕඖකඛගඝඞඟචඡජඣඤඥඦටඨඩඪණඬතථදධනඳපඵබභමඹයරලවශෂසහළෆ","n":"Sinhala"},"mya":{"w":2,"s":7.3,"c":"ကခဂဃငစဆဇဈဉညဋဌဍဎဏတထဒဓနပဖဗဘမယရလဝသဟဠအၐၑၒၓၔၕ","n":"Myanmar"},"khm":{"w":2,"s":8.5,"c":"កខគឃងចឆជញដឋឌឍណតថទធនបផពភមយរលវឝឞសហឡអ","n":"Khmer"},"run":{"w":4,"s":8.2,"c":"ᚠᚡᚢᚣᚤᚥᚦᚧᚨᚩᚪᚫᚬᚭᚮᚯᚰᚱᚲᚳᚴᚵᚶᚷᚸᚹᚺᚻᚼᚽᚾᚿᛀᛁᛂᛃᛄᛅᛆᛇᛈᛉᛊᛋᛍᛎᛏᛐᛑᛒᛓᛔᛕᛖᛗᛘᛙᛚᛛᛜᛝᛞᛟᛠᛡᛣᛤᛥᛦᛨᛩᛪᛮᛯᛰ","n":"Runic"},"got":{"w":3,"s":9.3,"c":"𐌰𐌱𐌲𐌳𐌴𐌵𐌶𐌷𐌸𐌺𐌻𐌼𐌽𐌾𐌿𐍀𐍁𐍂𐍃𐍄𐍅𐍆𐍇𐍈𐍉𐍊","n":"Gothic"},"ita":{"w":3,"s":9.1,"c":"𐌀𐌁𐌂𐌃𐌄𐌅𐌆𐌇𐌈𐌊𐌋𐌌𐌍𐌎𐌏𐌐𐌑𐌒𐌓𐌔𐌕𐌖𐌗𐌘𐌙𐌚𐌛𐌜𐌝𐌞𐌟","n":"Old Italic"},"phn":{"w":3,"s":9.1,"c":"𐤀𐤁𐤂𐤃𐤄𐤅𐤆𐤇𐤈𐤉𐤊𐤋𐤌𐤍𐤎𐤏𐤐𐤑𐤒𐤓𐤔𐤕","n":"Phoenician"},"lnb":{"w":3,"s":7.6,"c":"𐀀𐀁𐀂𐀃𐀄𐀅𐀆𐀇𐀈𐀉𐀊𐀋𐀍𐀎𐀏𐀐𐀑𐀒𐀓𐀔𐀕𐀖𐀗𐀘𐀙𐀚𐀛𐀜𐀝𐀞𐀟𐀠𐀡𐀢𐀣𐀤𐀥𐀦𐀨𐀩𐀪𐀫𐀬𐀭𐀮𐀯𐀰𐀱𐀲𐀳𐀴𐀵𐀶𐀷𐀸𐀹𐀺𐀼𐀽𐀿𐁀𐁁𐁂𐁃𐁄𐁅𐁆𐁇𐁈𐁉𐁊𐁋𐁌𐁍𐁐𐁑𐁒𐁓𐁔𐁕𐁖𐁗𐁘𐁙𐁚𐁛𐁜𐁝𐂀𐂁𐂂𐂃𐂄𐂅𐂆𐂇𐂈𐂉𐂊𐂋𐂌𐂍𐂎𐂏𐂐𐂑𐂒𐂓𐂔𐂕𐂖𐂗𐂘𐂙𐂚𐂛𐂜𐂝𐂞𐂟𐂠𐂡𐂢𐂣𐂤𐂥𐂦𐂧𐂨𐂩𐂪𐂫𐂬𐂭𐂮𐂯𐂰𐂲𐂳𐂴𐂵𐂶𐂷𐂸𐂹𐂺𐂻𐂼𐂽𐂾𐂿𐃀𐃁𐃂𐃃𐃄𐃅𐃇𐃈𐃉𐃊𐃋𐃏𐃐𐃑𐃒𐃓𐃔𐃕𐃖𐃗𐃘𐃙𐃛𐃜𐃝𐃞𐃟𐃠𐃡𐃢𐃣𐃤𐃥𐃦𐃧𐃨𐃩𐃪𐃫𐃬𐃭𐃮𐃯𐃰𐃱𐃲𐃳𐃴𐃶𐃷𐃸𐃹𐃺","n":"Linear B"},"cop":{"w":3,"s":9.5,"c":"ⲀⲁⲂⲃⲄⲅⲆⲇⲈⲉⲊⲋⲌⲍⲎⲏⲐⲑⲒⲔⲕⲖⲗⲘⲙⲚⲛⲜⲝⲞⲟⲠⲡⲢⲣⲤⲥⲦⲧⲨⲩⲪⲫⲬⲭⲮⲯⲰⲱⲲⲳⲴⲵⲶⲷⲸⲹⲼⲽⲾⲿⳀⳁⳃⳄⳅⳆⳇⳈⳉⳊⳋⳌⳍⳎⳏⳐⳑⳒⳓⳔⳕⳖⳗⳘⳙⳚⳛⳜⳝⳞⳟⳠⳡⳢⳣⳤ⳥⳦⳨⳩⳪ⳫⳬⳭⳮⳲⳳϢϣϤϥϦϧϨϩϪϫϬϭϮϯ","n":"Coptic"},"tfn":{"w":3,"s":9.8,"c":"ⴰⴱⴲⴳⴴⴵⴶⴷⴸⴹⴺⴻⴼⴽⴾⴿⵀⵁⵂⵃⵄⵅⵆⵇⵈⵉⵊⵋⵌⵍⵎⵏⵐⵑⵒⵓⵔⵕⵖⵗⵘⵙⵚⵛⵜⵝⵞⵟⵠⵡⵢⵣⵤⵥⵦ","n":"Tifinagh"},"osa":{"w":3,"s":8.8,"c":"𐒰𐒱𐒲𐒳𐒴𐒵𐒶𐒷𐒸𐒹𐒺𐒻𐒼𐒽𐒾𐒿𐓀𐓁𐓂𐓃𐓄𐓅𐓆𐓇𐓈𐓉𐓊𐓋𐓌𐓍𐓎𐓏𐓐𐓑𐓒𐓓𐓘𐓙𐓚𐓛𐓜𐓝𐓞𐓟𐓠𐓡𐓢𐓣𐓤𐓥𐓦𐓧𐓨𐓩𐓪𐓫𐓬𐓭𐓮𐓯𐓰𐓱𐓲𐓳𐓴𐓵𐓶𐓷𐓸𐓹𐓺𐓻","n":"Osage"},"shw":{"w":3,"s":11.9,"c":"𐑐𐑑𐑒𐑓𐑔𐑕𐑖𐑗𐑘𐑙𐑚𐑛𐑜𐑝𐑞𐑟𐑠𐑡𐑢𐑣𐑤𐑥𐑦𐑧𐑨𐑩𐑪𐑫𐑬𐑭𐑮𐑯𐑰𐑱𐑲𐑳𐑴𐑵𐑶𐑷𐑸𐑹𐑺𐑻𐑼𐑽𐑾𐑿","n":"Shavian"},"vai":{"w":3,"s":7.9,"c":"ꔀꔁꔂꔃꔄꔅꔆꔇꔈꔉꔊꔋꔌꔍꔎꔏꔐꔑꔒꔓꔔꔕꔖꔗꔘꔙꔚꔛꔜꔝꔟꔠꔡꔢꔣꔤꔥꔦꔧꔨꔩꔪꔫꔬꔭꔮꔯꔰꔱꔲꔳꔴꔵꔶꔷꔸꔹꔺꔻꔼꔽꔾꔿꕀꕁꕂꕃꕄꕅꕆꕇꕈꕉꕊꕋꕌꕍꕎꕏꕐꕑꕒꕓꕔꕕꕖꕗꕘꕙꕚꕛꕜꕝꕞꕟꕠꕡꕢꕣꕤꕥꕦꕧꕨꕩꕪꕫꕬꕭꕮꕯꕰꕱꕲꕳꕴꕵꕶꕷꕸꕹꕺꕻꕼꕽꕾꕿꖀꖁꖂꖃꖄꖅꖆꖇꖈꖉꖊꖋꖌꖍꖎꖏꖐꖑꖒꖓꖔꖕꖖꖗꖘꖙꖚꖛꖜꖝꖞꖟꖠꖡꖢꖣꖤꖥꖦꖧꖨꖩꖪꖫꖬꖭꖮꖯꖰꖱꖲꖳꖴꖵꖶꖷꖸꖹꖺꖻꖼꖽꖾꖿꗀꗁꗂꗃꗄꗅꗆꗇꗈꗉꗊꗋꗌꗍꗎꗏꗐꗑꗒꗓꗔꗕꗖꗗꗘꗙꗚꗛꗜꗝꗞꗟꗠꗡꗢꗣꗤꗥꗦꗧꗨꗩꗪꗫꗬꗭꗮꗯꗰꗱꗲꗳꗴꗵꗶꗷꗸꗹꗺꗻꗼꗽꗾꗿꘀꘁꘂꘃꘄꘅꘆꘇꘈꘉꘊꘋꘌꘐꘑꘒꘓꘔꘕꘖꘗꘘꘙꘚꘛꘜꘝꘞꘟꘪꘫ","n":"Vai"},"adl":{"w":3,"s":8.2,"c":"𞤀𞤁𞤂𞤃𞤄𞤅𞤆𞤇𞤈𞤉𞤊𞤋𞤌𞤍𞤎𞤏𞤐𞤑𞤒𞤓𞤔𞤕𞤖𞤗𞤘𞤙𞤚𞤛𞤜𞤝𞤞𞤟𞤠𞤡𞤢𞤣𞤤𞤥𞤦𞤧𞤨𞤩𞤪𞤫𞤬𞤭𞤮𞤯𞤰𞤱𞤲𞤳𞤴𞤵𞤶𞤷𞤸𞤹𞤺𞤻𞤼𞤽𞤾𞤿𞥀𞥁𞥂𞥃","n":"Adlam"},"nko":{"w":3,"s":11.1,"c":"ߊߋߌߍߎߏߐߑߒߓߔߕߖߗߘߙߚߛߜߝߞߟߠߡߢߣߤߥߦߧߨߩߪ","n":"N'Ko"},"yii":{"w":3,"s":10.4,"c":"ꀀꀃꀆꀉꀌꀏꀒꀕꀘꀛꀞꀡꀤꀧꀪꀭꀰꀳꀶꀹꀼꀿꁂꁅꁈꁋꁎꁑꁔꁗꁚꁝꁠꁣꁦꁩꁬꁯꁲꁵꁸꁻꁾꂁꂄꂇꂌꂏꂒꂕꂘꂛꂞꂡꂤꂧꂪꂭꂰꂳꂶꂹꂼꂿꃂꃅꃈꃋꃎꃑꃔꃗꃚꃝꃠꃣꃦꃩꃬꃯꃲꃵꃸꃻꃾꄁꄄꄇꄊꄍꄐꄓꄖꄙꄜꄟꄢꄥꄨꄫꄮꄱꄴꄷꄺꄽꅀꅃꅆꅉꅌꅏꅒꅕꅘꅛꅞꅡꅤꅧꅪꅭꅰꅳꅶꅹꅼꅿꆂꆅꆈꆋꆎꆑꆔꆗꆚꆝꆠꆣꆦꆩꆬꆯꆲꆵꆸꆻꆾꇁꇄꇇꇊꇍꇐꇓꇖꇙꇜꇟꇢꇥꇨꇫꇮꇱꇴꇷꇺꇽꈀꈃꈆꈉꈌꈏꈒꈕꈘꈛꈞꈡꈤꈧꈪꈭꈰꈳꈶꈹꈼꈿꉂꉅꉈꉋꉎꉑꉔꉗꉚꉝꉠꉣꉦꉩꉬꉯꉲꉵꉸꉻꉾꊁꊄꊇꊊꊍꊐꊓꊖꊙꊜꊟꊢꊥꊨꊫꊮꊱꊴꊷꊺꊽꋀꋃꋆꋉꋌꋏꋒꋕꋘꋛꋞꋡꋤꋧꋪꋭꋰꋳꋶꋹꋼꋿꌂꌅꌈꌋꌎꌑꌔꌗꌚꌝꌠꌣꌦꌩꌬꌯꌲꌵꌸꌻꌾꍁꍄꍇꍊꍍꍐꍓꍖꍙꍜꍟꍢꍥꍨꍫꍮꍱꍴꍷꍺꍽꎀꎃꎆꎉꎌꎏꎒꎕꎘꎛꎞꎡꎤꎧꎪꎭꎰꎳꎶꎹꎼꎿꏂꏅꏈꏋꏎꏑꏔꏗꏚꏝꏠꏣꏦꏩꏬꏯꏲꏵꏸꏻꏾꐁꐄꐇꐊꐍꐐꐓꐖꐙꐜꐟꐢꐥꐨꐫꐮꐱꐴꐷꐺꐽꑀꑃꑆꑉꑌꑏꑒꑕꑘꑛꑞꑡꑤꑧꑪꑭꑰꑳꑶꑹꑼꑿꒂꒅꒈꒋ","n":"Yi"},"gla":{"w":3,"s":7.2,"c":"ⰀⰁⰂⰃⰄⰅⰆⰇⰈⰉⰊⰋⰌⰍⰎⰏⰐⰑⰒⰓⰔⰕⰖⰗⰘⰙⰚⰛⰜⰝⰞⰟⰠⰡⰢⰣⰤⰥⰦⰧⰨⰩⰪⰫⰬⰭⰮⰯⰰⰱⰲⰳⰴⰵⰶⰷⰸⰹⰺⰻⰼⰽⰾⰿⱀⱁⱂⱃⱄⱅⱆⱇⱈⱉⱊⱋⱌⱍⱎⱏⱐⱑⱒⱓⱔⱕⱖⱗⱘⱙⱚⱛⱝⱞ","n":"Glagolitic"},"eth":{"w":3,"s":6.6,"c":"ሀሂሄሆለሊሌሎሐሒሔሖመሚሜሞሠሢሤሦረሪሬሮሰሲሴሶሸሺሼሾቀቂቄቆቈቊቌቐቒቔቖቘቚቜበቢቤቦቨቪቬቮተቲቴቶቸቺቼቾኀኂኄኆኈኊኌነኒኔኖኘኚኜኞአኢኤኦከኪኬኮኰኲኴኸኺኼኾዀዂዄወዊዌዎዐዒዔዖዘዚዜዞዠዢዤዦየዪዬዮደዲዴዶዸዺዼዾጀጂጄጆገጊጌጎጐጒጔጘጚጜጞጠጢጤጦጨጪጭጯጱጳጵጷጹጻጽጿፁፃፅፇፉፋፍፏፑፓፕፗፙᎁᎃᎅᎇᎉᎋᎍᎏ᎔᎘ⶀⶂⶄⶆⶈⶊⶌⶎⶑⶓⶕⶡⶣⶥⶩⶫⶭⶱⶳⶵⶹⶻⶾⷀⷂⷄⷆⷈⷊⷌⷎⷐⷒⷔⷖⷘⷚⷜⷞ","n":"Ethiopic"},"syr":{"w":3,"s":8,"c":"ܐܒܓܔܕܖܗܘܚܛܜܞܟܠܡܢܣܤܥܦܧܨܩܪܫܬܭܮܯ","n":"Syriac"},"thn":{"w":3,"s":9.5,"c":"ހށނރބޅކއވމފދތލގޏސޑޒޓޔޕޖޗޘޙޚޛޜޝޞޟޠޡޢޣޤޥ","n":"Thaana"},"lao":{"w":3,"s":10.1,"c":"ກຂຄງຈຊຍດຕຖທນບປຜຝພຟມຢຣລວສຫອຮ","n":"Lao"},"bam":{"w":2,"s":9.9,"c":"ꚠꚡꚢꚣꚤꚥꚦꚧꚨꚩꚪꚫꚬꚭꚮꚯꚰꚱꚲꚳꚴꚵꚶꚷꚸꚹꚺꚻꚼꚽꚾꚿꛀꛁꛂꛃꛄꛅꛆꛇꛈꛉꛊꛋꛌꛍꛎꛏꛐꛑꛒꛓꛔꛕꛖꛗꛘꛙꛚꛛꛜꛝꛞꛟꛠꛡꛢꛣꛤꛥꛦꛧꛨꛩꛪꛫꛬꛭꛮꛯ","n":"Bamum"},"ave":{"w":2,"s":9.4,"c":"𐬀𐬂𐬄𐬅𐬆𐬇𐬈𐬉𐬊𐬋𐬌𐬍𐬎𐬏𐬐𐬑𐬒𐬓𐬔𐬕𐬖𐬗𐬘𐬙𐬚𐬛𐬜𐬝𐬞𐬟𐬠𐬡𐬢𐬣𐬤𐬦𐬧𐬨𐬩𐬪𐬫𐬬𐬭𐬮𐬯𐬰𐬱𐬲𐬳𐬴𐬵","n":"Avestan"},"olt":{"w":2,"s":9.5,"c":"𐰀𐰁𐰂𐰃𐰄𐰅𐰆𐰇𐰈𐰉𐰊𐰋𐰌𐰍𐰎𐰏𐰐𐰑𐰒𐰓𐰔𐰕𐰖𐰗𐰘𐰙𐰚𐰛𐰜𐰝𐰞𐰟𐰠𐰡𐰢𐰣𐰤𐰥𐰦𐰧𐰨𐰩𐰪𐰫𐰬𐰭𐰮𐰯𐰰𐰱𐰲𐰳𐰴𐰵𐰶𐰷𐰸𐰹𐰺𐰻𐰼𐰽𐰾𐰿𐱀𐱁𐱂𐱃𐱄𐱅𐱆𐱇𐱈","n":"Old Turkic"},"arc":{"w":2,"s":9.2,"c":"𐡀𐡁𐡂𐡃𐡄𐡅𐡆𐡇𐡈𐡉𐡊𐡋𐡌𐡍𐡎𐡏𐡐𐡑𐡒𐡓𐡔𐡕","n":"Aramaic"},"nab":{"w":2,"s":11.4,"c":"𐢀𐢁𐢂𐢃𐢄𐢅𐢆𐢇𐢈𐢉𐢊𐢋𐢌𐢍𐢎𐢏𐢐𐢑𐢒𐢓𐢔𐢕𐢖𐢗𐢘𐢙𐢚𐢛𐢜𐢝𐢞","n":"Nabataean"},"pal":{"w":2,"s":10,"c":"𐡠𐡡𐡢𐡣𐡤𐡥𐡦𐡧𐡨𐡩𐡪𐡫𐡬𐡭𐡮𐡯𐡰𐡱𐡲𐡳𐡴𐡵𐡶","n":"Palmyrene"},"man":{"w":2,"s":7.6,"c":"𐫀𐫁𐫂𐫃𐫄𐫅𐫆𐫇𐫈𐫉𐫊𐫋𐫌𐫍𐫎𐫏𐫐𐫑𐫒𐫓𐫔𐫕𐫖𐫗𐫘𐫙𐫚𐫛𐫜𐫝𐫞𐫟𐫠𐫡𐫢𐫣𐫤","n":"Manichaean"},"car":{"w":2,"s":8.8,"c":"𐊠𐊡𐊢𐊣𐊤𐊥𐊦𐊧𐊨𐊩𐊪𐊫𐊬𐊭𐊮𐊯𐊰𐊱𐊲𐊳𐊴𐊵𐊶𐊷𐊸𐊹𐊺𐊻𐊼𐊽𐊾𐊿𐋀𐋁𐋂𐋃𐋄𐋅𐋆𐋇𐋈𐋉𐋊𐋋𐋌𐋍𐋎𐋏𐋐","n":"Carian"},"lyc":{"w":2,"s":9.5,"c":"𐊀𐊁𐊂𐊃𐊄𐊅𐊆𐊇𐊈𐊉𐊊𐊋𐊌𐊍𐊎𐊏𐊐𐊑𐊒𐊓𐊔𐊕𐊖𐊗𐊘𐊙𐊚𐊛𐊜","n":"Lycian"},"lyd":{"w":2,"s":9.6,"c":"𐤠𐤡𐤢𐤣𐤤𐤥𐤦𐤧𐤨𐤩𐤪𐤫𐤬𐤭𐤮𐤯𐤰𐤱𐤲𐤳𐤴𐤵𐤶𐤷𐤸𐤹","n":"Lydian"},"ugr":{"w":2,"s":6.1,"c":"𐎀𐎁𐎂𐎃𐎄𐎅𐎆𐎇𐎈𐎉𐎊𐎋𐎌𐎍𐎎𐎏𐎐𐎑𐎒𐎓𐎔𐎕𐎖𐎗𐎘𐎙𐎚𐎛𐎜𐎝","n":"Ugaritic"},"opr":{"w":2,"s":5.2,"c":"𐎠𐎡𐎢𐎣𐎤𐎥𐎦𐎧𐎨𐎩𐎪𐎫𐎬𐎭𐎮𐎯𐎰𐎱𐎲𐎳𐎴𐎵𐎶𐎷𐎸𐎹𐎺𐎻𐎼𐎽𐎾𐎿𐏀𐏁𐏂𐏃","n":"Old Permic"},"mer":{"w":2,"s":7.2,"c":"𐦀𐦁𐦂𐦃𐦄𐦅𐦆𐦇𐦈𐦉𐦊𐦋𐦌𐦍𐦎𐦏𐦑𐦒𐦓𐦔𐦕𐦖𐦗𐦘𐦚𐦛𐦜𐦝𐦞𐦟𐦠𐦡𐦢𐦤𐦥𐦦𐦧𐦨𐦩𐦪𐦫𐦬𐦭𐦮𐦯𐦰𐦱𐦲𐦳𐦴𐦵𐦶𐦷","n":"Meroitic"},"olc":{"w":2,"s":9.6,"c":"ᱚᱛᱜᱝᱞᱟᱠᱡᱢᱣᱤᱥᱦᱧᱨᱩᱪᱫᱬᱭᱮᱯᱰᱱᱲᱳᱴᱵᱶᱷ","n":"Ol Chiki"},"cham":{"w":2,"s":5.5,"c":"ꨀꨁꨂꨃꨄꨅꨆꨇꨈꨉꨊꨋꨌꨍꨎꨏꨐꨑꨒꨓꨔꨕꨖꨗꨘꨙꨚꨛꨜꨝꨞꨟꨠꨡꨢꨣꨤꨥꨦꨧꨨ","n":"Cham"},"bali":{"w":2,"s":5.8,"c":"ᬅᬆᬇᬈᬉᬊᬋᬌᬍᬎᬏᬐᬑᬒᬓᬔᬕᬖᬗᬘᬙᬚᬛᬜᬝᬞᬟᬠᬡᬢᬣᬤᬥᬦᬧᬨᬩᬪᬫᬬᬭᬮᬯᬰᬱᬲᬳ","n":"Balinese"},"java":{"w":2,"s":5.6,"c":"ꦄꦅꦆꦇꦈꦉꦊꦋꦌꦍꦎꦏꦐꦑꦒꦓꦔꦕꦖꦗꦘꦙꦚꦛꦜꦝꦞꦟꦠꦡꦢꦣꦤꦥꦦꦧꦨꦩꦪꦫꦬꦭꦮꦯꦰꦱꦲ","n":"Javanese"},"bugi":{"w":2,"s":6.2,"c":"ᨀᨁᨂᨃᨄᨅᨆᨇᨈᨉᨊᨋᨌᨍᨎᨏᨐᨑᨒᨓᨔᨕᨖ","n":"Buginese"},"batk":{"w":2,"s":6.1,"c":"ᯀᯁᯂᯃᯄᯅᯆᯈᯉᯊᯋᯌᯍᯎᯏᯐᯑᯒᯓᯔᯕᯖᯗᯘᯙᯚᯛᯜᯝᯞᯟᯠᯡᯢᯣᯤᯥ","n":"Batak"},"lisu":{"w":2,"s":9.7,"c":"ꓐꓑꓒꓓꓔꓕꓖꓗꓘꓙꓚꓛꓜꓝꓞꓟꓠꓡꓢꓣꓤꓥꓦꓧꓨꓩꓪꓫꓬꓭꓮꓯꓰꓱꓲꓳꓴꓵꓶꓷ","n":"Lisu"},"bass":{"w":2,"s":8.5,"c":"𖫐𖫑𖫒𖫓𖫔𖫕𖫖𖫗𖫘𖫙𖫚𖫛𖫜𖫝𖫞𖫟𖫠𖫡𖫢𖫣𖫤𖫥𖫦𖫧𖫨𖫩𖫪𖫫𖫬𖫭","n":"Bassa Vah"},"mend":{"w":2,"s":8.5,"c":"𞠀𞠁𞠂𞠃𞠄𞠅𞠆𞠇𞠈𞠉𞠊𞠋𞠌𞠍𞠎𞠏𞠐𞠒𞠓𞠔𞠕𞠖𞠗𞠘𞠙𞠚𞠛𞠜𞠝𞠞𞠟𞠠𞠡𞠣𞠤𞠥𞠦𞠧𞠨𞠩𞠪𞠫𞠬𞠭𞠮𞠯𞠰𞠱𞠲𞠳𞠴𞠵𞠶𞠷𞠸𞠹𞠺𞠻𞠼𞠽𞠾𞠿𞡀𞡁𞡂𞡃𞡄𞡅𞡆𞡇𞡈𞡉𞡊𞡋𞡌𞡍𞡎𞡏𞡐𞡑𞡒𞡓𞡔𞡕𞡖𞡗𞡘𞡙𞡚𞡛𞡜𞡝𞡞𞡟𞡠𞡡𞡢𞡣𞡤𞡥𞡦𞡧𞡨𞡩𞡪𞡫𞡬𞡭𞡮𞡯𞡰","n":"Mende"},"wcho":{"w":2,"s":9.4,"c":"𞋀𞋁𞋂𞋃𞋄𞋅𞋆𞋇𞋈𞋉𞋊𞋋𞋌𞋍𞋎𞋏𞋐𞋑𞋒𞋓𞋔𞋕𞋖𞋗𞋘𞋙𞋚𞋛𞋜𞋝𞋞𞋟𞋠𞋡𞋢𞋣𞋤𞋥𞋦𞋧𞋨𞋩𞋪𞋫","n":"Wancho"},"rohg":{"w":2,"s":11,"c":"𐴀𐴁𐴂𐴃𐴄𐴅𐴆𐴇𐴈𐴉𐴊𐴋𐴌𐴍𐴎𐴏𐴐𐴒𐴓𐴔𐴖𐴗𐴘𐴙𐴚𐴛𐴜𐴝𐴞𐴟𐴠𐴡𐴢𐴣","n":"Rohingya"},"tale":{"w":2,"s":10.3,"c":"ᥐᥑᥒᥓᥔᥕᥖᥗᥘᥙᥚᥛᥜᥝᥞᥟᥠᥡᥢᥣᥤᥥᥦᥧᥨᥩᥪᥫᥬᥭ","n":"Tai Le"},"mth":{"w":3,"s":10.0,"c":"∑∏∫√∞≠≤≥∂∆∇⊂⊃∈∀∃⊕⊗","n":"Math"},"pla":{"w":2,"s":10.0,"c":"☉☽☿♀♁♂♃♄♅♆♇☊☋","n":"Planetary"},"alc":{"w":2,"s":6.6,"c":"🜁🜂🜃🜄🜅🜆🜇🜈🜉🜊🜋🜌🜍🜔🜛🜚","n":"Alchemy"}};
  var MIRROR_OK = ["lat", "dig", "grk", "cyr", "mrk"];
  var SYM = "AHIMOTUVWXY08.:\u00d7\u00f7\u00b1\u00b0\u2021\u2020\u0391\u0394\u0397\u0398\u0399\u039b\u039c\u039e\u039f\u03a0\u03a4\u03a5\u03a6\u03a7\u03a8\u03a9\u0410\u0414\u0416\u041b\u041c\u041d\u041e\u041f\u0422\u0424\u0425\u0428";

  var BAG = [], k, i;
  for (k in POOL) {
    /* Array.from splits by CODE POINT. Plain string indexing splits by UTF-16
       code unit, which tears every astral-plane script — Deseret, Linear B,
       Gothic, Osage, Shavian, Adlam and the four historical Sanskrit hands all
       live above U+FFFF — into lone surrogates that render as boxes. */
    POOL[k].a = Array.from(POOL[k].c);
    for (i = 0; i < POOL[k].w; i++) BAG.push(k);
  }
  var MOK = {};
  for (i = 0; i < MIRROR_OK.length; i++) MOK[MIRROR_OK[i]] = 1;
  function rnd(n) { return (Math.random() * n) | 0; }

  function strike(el) {
    var key = BAG[rnd(BAG.length)], set = POOL[key].a;
    var ch = set[rnd(set.length)];
    /* a reversal only reads as one on a script the viewer recognises, and
       never on a glyph that is symmetrical about its own vertical axis.
       Mirror and spin live on the INNER wrapper: the scale/rotate must
       never touch the outer cell's JS-written translate, or the glyph
       teleports off its path (scale multiplies the translation too). */
    var rev = MOK[key] && SYM.indexOf(ch) < 0 && Math.random() < 0.18;
    el.className = 'cr-g cr-' + key;
    var inner = el.firstChild;
    inner.className = (el.getAttribute('data-spin') || '') +
                      (rev ? ' is-rev' : '');
    inner.textContent = ch;
  }

  function fill(s) {
    var cells = s.children, n = cells.length, i;
    for (i = 0; i < n; i++) strike(cells[i]);
  }

  /* ========================================================================
     THE TRAFFIC MANAGER — paths, not lanes, and still zero collisions.

     A stream is no longer a straight strip on one lane: it is a PATH on the
     grid. It enters from an edge, runs straight or turns — cell centre to
     cell centre, always orthogonally, never crossing its own trail — and
     leaves by any edge. Motion is smooth (constant speed, positions written
     to transform by the renderer), and because the whole path is fixed at
     birth, occupancy is closed-form:
     measure ARCLENGTH along the path in cells; glyph j rides at arclength
     s−j where s = v·(t−t0), and path cell i (centre at arclength i) is
     touched while s ∈ (i−0.5, i+len−0.5). Born at t0, that is the seconds
     interval [t0 + (i−0.5)/v, t0 + (i+len−0.5)/v]. The reservation table
     holds one interval list per grid cell; the planner only births a path
     whose intervals conflict with nothing already booked. Streams never
     brake, yield, or reroute — traffic is solved at birth or not at all.

     Paths turn because the mesh is the point: a straight rain reads as
     weather, a turning one reads as TRAFFIC. Roughly half the paths are
     dealt 1–3 corners; the rest stay straight, keeping the rain's memory.

     Births are dealt ONE per planner tick. Burst births were the wave bug:
     streams born in the same cycle traverse in lockstep, wrap together, and
     the sheet oscillated between orientations. One per tick decorrelates
     them for good.
     ====================================================================== */

  /* motion is SMOOTH (linear CSS animation, continuous px); only the
     collision model is discrete, because the paper's cells are. Speeds are
     cells per second — zoom-independent by construction, and matched to the
     original rain's pace: 22–42 squares/sec in 9px-square units = 2.4–4.7
     cells/sec at the doubled cell. Much faster and a glyph crosses its own
     square in a frame or two, which strobes instead of gliding. */
  var SPD_MIN = 2.2, SPD_SPAN = 2.5;   /* 2.2–4.7 cells/sec */
  var DEBUG = /[?&]debug/.test(location.search);

  /* per-mount state */
  var grid = null;          /* { cols, rows, CELL, host, spinP } */
  var booked = new Map();   /* cellKey -> [[t0, t1, id], ...] */
  var live = [];            /* stream records: { id, el, keys, slot } */
  var slots = [];
  var nextId = 1;
  var timers = [];
  var stubbornP = 0.35;     /* live-tunable via KimisTake.set() */
  var words = null;         /* opt.words: every stream IS a word, head first */
  var spdMin = SPD_MIN, spdSpan = SPD_SPAN;   /* per-mount via opt.speed* */

  /* the piece's clock is the wall clock MINUS whatever time it spent paused,
     so pausing freezes everything the model does — births, retirements,
     positions — and resuming continues exactly where it left off */
  var paused = false, pausedAt = 0, pauseAccum = 0;
  function nowSec() {
    return ((paused ? pausedAt : performance.now()) - pauseAccum) / 1000;
  }
  function keyOf(row, col) { return (row << 10) | col; }

  var DVEC = { d: [0, 1], u: [0, -1], r: [1, 0], l: [-1, 0] };

  /* Is one cell clear for a strip's whole passage? The window covers the
     head's arrival through the tail's departure, padded to a visible beat. */
  function cellFree(key, idx, len, v, t0) {
    var a = t0 + (idx - 0.5) / v - PAD, b = t0 + (idx + len - 0.5) / v + PAD;
    var list = booked.get(key);
    if (!list) return true;
    for (var m = 0; m < list.length; m++) {
      if (a < list[m][1] && list[m][0] < b) return false;
    }
    return true;
  }

  /* Deal a path REACTIVELY. Enters from the edge dir implies with the
     strip's length plus margin behind it, then runs straight until it has
     a reason not to: a stream turns ONLY when the cell ahead is already
     booked for the moment the strip would arrive — then it takes whichever
     perpendicular is clear, snake-game style. Streams with an open road
     never turn, so an empty sheet is pure rain and a busy one weaves.
     Off-sheet travel is invisible and needs no clearance; leaving the sheet
     is always allowed and is the exit. Returns null when the walk is boxed
     in — the planner deals again with a different lane, speed or moment.

     STUBBORN streams (a dealt share of births) carry a commission: exit by
     the edge OPPOSITE the one they entered — which is exactly the edge their
     entry heading points at. They still yield to traffic, but two rules
     change: a wrong edge is a wall, not an exit, and when traffic has pushed
     them off course they steer back toward the target at the next clear
     square. A stubborn stream that has wandered past its budget gives up and
     leaves by any edge — the release valve that keeps a stubborn majority
     from gridlocking the sheet. */
  function genPath(dir, len, v, t0, stubborn) {
    var cols = grid.cols, rows = grid.rows;
    var mB = len + 2 + rnd(8), mA = len + 2 + rnd(8);
    var heading = DVEC[dir], col, row;
    if (dir === 'd') { col = rnd(cols); row = -mB; }
    else if (dir === 'u') { col = rnd(cols); row = rows - 1 + mB; }
    else if (dir === 'r') { row = rnd(rows); col = -mB; }
    else { row = rnd(rows); col = cols - 1 + mB; }
    var cells = [[col, row]];
    var seen = {}; seen[col + ',' + row] = 1;
    var onSheet = false, exiting = false, onLen = 0, sinceCorrect = 0;
    var giveUp = false;
    var maxOn = 40 + rnd(30);   /* don't wander the sheet forever */
    var guard = mB + 3 * (cols + rows) + mA + 16;
    while (guard-- > 0) {
      var nc = col + heading[0], nr = row + heading[1];
      var on = nc >= 0 && nc < cols && nr >= 0 && nr < rows;
      if (exiting) {
        cells.push([nc, nr]); col = nc; row = nr;
        if (nc < -mA || nc >= cols + mA || nr < -mA || nr >= rows + mA) return cells;
        continue;
      }
      if (!onSheet) {
        cells.push([nc, nr]); col = nc; row = nr;
        if (on) { onSheet = true; seen[nc + ',' + nr] = 1; }
        continue;
      }
      if (onLen > maxOn) giveUp = true;   /* the release valve */
      if (!on) {
        /* leaving the sheet: stubborn streams only leave by the edge their
           commission names — any other edge is a wall */
        if (!stubborn || giveUp || heading === DVEC[dir]) {
          exiting = true; cells.push([nc, nr]); col = nc; row = nr; continue;
        }
      }
      var idx = cells.length;
      var straightOK = on && !seen[nc + ',' + nr] &&
                       cellFree(keyOf(nr, nc), idx, len, v, t0);
      if (stubborn && !giveUp && heading !== DVEC[dir]) {
        /* off course: steer back toward the commission at the next clear
           square (not instantly — a small run keeps the correction from
           reading as jitter) */
        var tc = col + DVEC[dir][0], tr = row + DVEC[dir][1];
        if (sinceCorrect >= 2 &&
            tc >= 0 && tc < cols && tr >= 0 && tr < rows &&
            !seen[tc + ',' + tr] &&
            cellFree(keyOf(tr, tc), idx, len, v, t0) &&
            Math.random() < 0.8) {
          heading = DVEC[dir]; sinceCorrect = 0; continue;
        }
      }
      if (straightOK) {
        cells.push([nc, nr]); seen[nc + ',' + nr] = 1; col = nc; row = nr;
        onLen++; sinceCorrect++;
        continue;
      }
      /* BLOCKED — turn. When the walk has wandered long, prefer the side
         that heads for the nearer edge, so exits come around in time. */
      var perps = heading[0] === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
      if (onLen >= maxOn) {
        perps.sort(function (a, b) {
          var da = a[0] ? (a[0] > 0 ? cols - 1 - col : col)
                        : (a[1] > 0 ? rows - 1 - row : row);
          var db = b[0] ? (b[0] > 0 ? cols - 1 - col : col)
                        : (b[1] > 0 ? rows - 1 - row : row);
          return da - db;
        });
      } else if (rnd(2)) perps.reverse();
      var chosen = null;
      for (var q = 0; q < 2; q++) {
        var qc = col + perps[q][0], qr = row + perps[q][1];
        if (qc >= 0 && qc < cols && qr >= 0 && qr < rows &&
            !seen[qc + ',' + qr] &&
            cellFree(keyOf(qr, qc), idx, len, v, t0)) { chosen = perps[q]; break; }
      }
      if (!chosen) return null;   /* boxed in — deal again */
      heading = chosen; onLen = 0; sinceCorrect = 0;
    }
    return null;
  }

  /* The load balancer's ledger: how many cell-seconds of each axis are
     currently booked. A stream passing over a cell occupies it for ~len/v
     seconds, so cost = on-sheet cells of each axis × len/v. */
  var axisTime = { v: 0, h: 0 };
  function axisCost(cells, len, v) {
    var cv = 0, ch = 0;
    for (var i = 1; i < cells.length; i++) {
      var c = cells[i];
      if (c[0] < 0 || c[0] >= grid.cols || c[1] < 0 || c[1] >= grid.rows) continue;
      if (c[0] === cells[i - 1][0]) cv++; else ch++;
    }
    var sec = len / v;
    return { v: cv * sec, h: ch * sec };
  }

  /* Cell i's centre sits at arclength i cells along the path; a glyph's box
     is one square, so cell i is touched while the head's arclength s lies in
     (i−0.5, i+len−0.5). In seconds, with the pad that gives every handoff a
     visible beat of clear paper (near-misses read as touches): */
  var PAD = 0.35;
  function pathIntervals(cells, len, v, t0) {
    var out = [];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i][0], r = cells[i][1];
      if (c < 0 || c >= grid.cols || r < 0 || r >= grid.rows) continue;
      out.push([keyOf(r, c), t0 + (i - 0.5) / v - PAD,
                t0 + (i + len - 0.5) / v + PAD]);
    }
    return out;
  }

  function conflicts(ivals) {
    for (var j = 0; j < ivals.length; j++) {
      var list = booked.get(ivals[j][0]);
      if (!list) continue;
      for (var m = 0; m < list.length; m++) {
        if (ivals[j][1] < list[m][1] && list[m][0] < ivals[j][2]) return true;
      }
    }
    return false;
  }

  function reserve(id, ivals) {
    if (DEBUG && conflicts(ivals)) {
      console.error('[kimis-take] double-booking detected, stream ' + id);
    }
    for (var j = 0; j < ivals.length; j++) {
      var list = booked.get(ivals[j][0]);
      if (!list) { list = []; booked.set(ivals[j][0], list); }
      list.push([ivals[j][1], ivals[j][2], id]);
    }
  }

  function release(id, keys) {
    for (var j = 0; j < keys.length; j++) {
      var list = booked.get(keys[j]);
      if (!list) continue;
      for (var m = list.length - 1; m >= 0; m--) {
        if (list[m][2] === id) list.splice(m, 1);
      }
      if (!list.length) booked.delete(keys[j]);
    }
  }

  function sweep(now) {
    booked.forEach(function (list, key) {
      for (var m = list.length - 1; m >= 0; m--) {
        if (list[m][1] < now - 1) list.splice(m, 1);
      }
      if (!list.length) booked.delete(key);
    });
  }

  function spawn(cells, len, v, t0, ivals, slot, stubborn, dir, word) {
    var id = nextId++, j;
    var P = cells.length;
    var st = document.createElement('span');
    st.className = 'cr-s' + (stubborn ? ' is-stubborn' : '');   /* TEMP: red ink
      while the commissioned behaviour is being watched — remove with the
      .cr-s.is-stubborn rule */
    st.style.setProperty('--cr-o', (0.62 + Math.random() * 0.38).toFixed(2));
    for (j = 0; j < len; j++) {
      var cell = document.createElement('i');
      cell.appendChild(document.createElement('u'));   /* mirror/spin wrapper */
      if (!word && Math.random() < grid.spinP) {
        cell.setAttribute('data-spin',
          ' is-spin' + (Math.random() < 0.5 ? ' is-ccw' : ''));
        cell.firstChild.style.setProperty('--cr-sd',
          (4 + Math.random() * 7).toFixed(2) + 's');
      }
      st.appendChild(cell);
    }
    if (word) {
      /* the letters are dealt once, at birth, and never re-struck — a
         re-struck letter is a misprint. Head to tail is reading order: the
         head arrives first wherever the path turns. A space is a blank
         square travelling inside the word. No mirrors, no pinwheels — a
         reversed letter is a different word. */
      var letters = Array.from(word), gs = st.children;
      for (j = 0; j < len; j++) {
        gs[j].className = 'cr-g cr-lat';
        gs[j].firstChild.textContent = letters[j] === ' ' ? '' : letters[j];
      }
    } else {
      fill(st);
    }
    var keys = [];
    for (j = 0; j < ivals.length; j++) keys.push(ivals[j][0]);
    reserve(id, ivals);
    var rec = { id: id, el: st, keys: keys, slot: slot,
                cells: cells, len: len, v: v, t0: t0, P: P,
                endT: t0 + (P - 1) / v,
                cost: axisCost(cells, len, v) };
    axisTime.v += rec.cost.v; axisTime.h += rec.cost.h;
    /* the sim harness (local-dev/kimis-take-sim.js) replays positions from
       these parameters and asserts no two streams ever share a cell */
    if (DEBUG) rec.plan = { cells: cells, len: len, v: v, t0: t0, P: P,
                            stubborn: !!stubborn, dir: dir };
    st.__rec = rec;
    grid.host.appendChild(st);
    live.push(rec);
    slot.free = false;
    positionStream(rec, nowSec());
  }

  /* THE RENDERER IS THE MODEL. Glyph j rides at arclength s−j along the
     path, s = v·(t−t0) — the same arithmetic the reservations are booked
     with, from the same wall clock, written straight to transform. No CSS
     animation, no second clock, no engine-specific keyframe behaviour to
     drift from the bookings. rAF drives it in the foreground; the planner
     tick re-renders at 4fps so background tabs (where rAF parks) stay
     honest too. */
  function positionStream(rec, now) {
    var cells = rec.cells, P = rec.P, CELL = grid.CELL;
    var els = rec.el.children;
    var s = rec.v * (now - rec.t0);
    for (var j = 0; j < rec.len; j++) {
      var q = s - j;
      if (q < 0) q = 0; else if (q > P - 1) q = P - 1;
      var i0 = Math.floor(q);
      if (i0 >= P - 1) i0 = P - 2;
      var fr = q - i0;
      var c0 = cells[i0], c1 = cells[i0 + 1];
      els[j].style.transform =
        'translate(' + ((c0[0] + (c1[0] - c0[0]) * fr) * CELL).toFixed(1) + 'px,' +
                       ((c0[1] + (c1[1] - c0[1]) * fr) * CELL).toFixed(1) + 'px)';
    }
  }

  var rafId = 0;
  function frame() {
    var now = nowSec();
    for (var r = 0; r < live.length; r++) positionStream(live[r], now);
    rafId = requestAnimationFrame(frame);
  }

  /* Birth one stream into clear spacetime, or leave the slot empty. The
     slot's compass point is the ENTRY heading; where the path goes from
     there is the walk's business. With seedPhase the stream starts
     mid-traverse (negative delays) so the sheet opens already woven.

     Collision-free is necessary but not sufficient: the MIX is a controlled
     quantity too. Up to three conflict-free candidates are dealt, and the
     one that most reduces the global vertical/horizontal booked-time
     imbalance is born. Straight horizontal runs live longer on a wide sheet
     (more cells to cross), so without this the horizontals slowly eat the
     page — with it the ledger corrects every birth. */
  function planCandidate(slot, seedPhase) {
    var cands = [];
    for (var attempt = 0; attempt < 40 && cands.length < 3; attempt++) {
      var dir = slot.dir || 'd';
      /* word mode: the stream IS the word — its length is the spelling's,
         dealt per candidate because the length shapes the walk */
      var word = null, len;
      if (words) {
        word = words[rnd(words.length)];
        len = Array.from(word).length;
        if (len < 2) continue;   /* one letter is not a string */
      } else {
        len = 8 + rnd(38);   /* 8–45 glyphs: paths wind, so the old
                                axis-length cap no longer applies */
      }
      var v = spdMin + Math.random() * spdSpan;
      var stubborn = Math.random() < stubbornP;   /* the commissioned share */
      /* t0 is dealt BEFORE the walk: the walk avoids cells by the moment
         the strip would arrive, so the moment has to exist first */
      var t0 = seedPhase ? nowSec() - Math.random() * 80
                         : nowSec() + Math.random() * 1.2;
      var cells = genPath(dir, len, v, t0, stubborn);
      if (!cells) continue;
      var dur = (cells.length - 1) / v;
      if (seedPhase && -t0 > dur) continue;   /* already done — redeal */
      var ivals = pathIntervals(cells, len, v, t0);
      if (conflicts(ivals)) continue;   /* belt and braces: the walk already
                                           checked each cell at arrival time */
      var cost = axisCost(cells, len, v);
      cands.push({ cells: cells, len: len, v: v, t0: t0, ivals: ivals,
                   cv: cost.v, ch: cost.h, stubborn: stubborn, dir: dir,
                   word: word });
    }
    if (!cands.length) return false;   /* the gap stays; the planner comes back around */
    var best = cands[0], bestScore = Infinity;
    for (var j = 0; j < cands.length; j++) {
      var sc = Math.abs((axisTime.v + cands[j].cv) - (axisTime.h + cands[j].ch));
      if (sc < bestScore) { bestScore = sc; best = cands[j]; }
    }
    spawn(best.cells, best.len, best.v, best.t0, best.ivals, slot,
          best.stubborn, best.dir, best.word);
    return true;
  }

  /* Retire streams whose traverse is done. Timer-driven, not event-driven:
     the head reaching the path's end (with the margins guaranteeing the
     tail is off the sheet behind it) is a fact about the clock, and the
     clock works in background tabs where animation events may not fire. */
  function retireDone(now) {
    for (var j = live.length - 1; j >= 0; j--) {
      var rec = live[j];
      if (now < rec.endT) continue;
      release(rec.id, rec.keys);
      axisTime.v -= rec.cost.v; axisTime.h -= rec.cost.h;
      rec.slot.free = true;   /* the planner rebirths it when spacetime clears */
      if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
      live.splice(j, 1);
    }
  }

  function build(host, opt) {
    opt = opt || {};
    var W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return 0;
    /* CSS owns the zoom: --cr-cell is the square every glyph sits in, and the
       same value rules the paper. Reading it here means the two cannot drift. */
    var css = getComputedStyle(host);
    var CELL = parseFloat(css.getPropertyValue('--cr-cell')) || 9;
    var cols = Math.floor(W / CELL), rows = Math.floor(H / CELL);
    if (cols < 4 || rows < 4) return 0;
    /* the host is snapped to whole cells so the ruling and the glyph squares
       share one origin */
    host.style.width = (cols * CELL) + 'px';
    host.style.height = (rows * CELL) + 'px';
    grid = { cols: cols, rows: rows, CELL: CELL, host: host,
             spinP: opt.spinP == null ? 0.06 : opt.spinP };
    if (opt.stubbornP != null) stubbornP = opt.stubbornP;
    words = opt.words && opt.words.length ? opt.words : null;
    spdMin = opt.speedMin == null ? SPD_MIN : opt.speedMin;
    spdSpan = opt.speedSpan == null ? SPD_SPAN : opt.speedSpan;
    booked = new Map();
    axisTime = { v: 0, h: 0 };
    live = [];
    slots = [];
    /* the cast: one slot per entry heading — down, up, right, left — each
       slot re-entering from its own edge forever, the path's turns re-dealt
       at every birth. opt.dirs overrides the cast; the page's dial deals
       n streams round-robin over the four points. */
    var dirs = opt.dirs || ['d', 'u', 'r', 'l'];
    for (var s = 0; s < dirs.length; s++) {
      slots.push({ free: true, dir: dirs[s] });
    }
    /* deal the first page: seeds start mid-traverse, so the sheet opens
       already woven rather than filling in from the edges */
    for (s = 0; s < slots.length; s++) {
      planCandidate(slots[s], true);
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      /* the planner: retires finished streams, then keeps free slots filled,
         ONE birth per tick. Burst births were the wave bug — streams born
         together traverse together, wrap together, and the sheet oscillated
         between orientations. An empty slot is just another gap in the rain. */
      timers.push(setInterval(function () {
        if (paused) return;
        var now = nowSec();
        sweep(now);
        retireDone(now);
        for (var j = 0; j < slots.length; j++) {
          if (slots[j].free) { planCandidate(slots[j], false); break; }
        }
        /* rAF parks in hidden tabs; keep positions honest at 4fps there */
        for (j = 0; j < live.length; j++) positionStream(live[j], now);
      }, 250));
      if (!paused) { cancelAnimationFrame(rafId); frame(); }
      /* the slow in-view re-strike: a few squares a second, caught out of the
         corner of an eye rather than watched. Word streams are never
         re-struck — a changed letter is a misprint — so the default there
         is stillness */
      var rate = opt.visibleRate == null ? (words ? 0 : 10) : opt.visibleRate;
      if (rate > 0) timers.push(setInterval(function () {
        if (paused || !live.length) return;
        for (var i = 0; i < rate; i++) {
          var rec = live[rnd(live.length)];
          if (!rec) continue;
          var cell = rec.el.children[rnd(rec.el.children.length)];
          if (cell) strike(cell);
        }
      }, 1000));
    }
    return live.length;
  }

  window.KimisTake = {
    scripts: Object.keys(POOL).length,
    characters: (function () {
      var seen = {}, n = 0;
      for (var k in POOL) {
        for (var i = 0; i < POOL[k].a.length; i++) {
          if (!seen[POOL[k].a[i]]) { seen[POOL[k].a[i]] = 1; n++; }
        }
      }
      return n;
    })(),
    /* the dial's readout: how many streams are actually on the sheet vs how
       many the cast asked for — at high counts the gap is the point */
    stats: function () { return { live: live.length, slots: slots.length }; },
    /* lab controls: pause freezes the piece's own clock (render, planner,
       births, retirements); resume continues from the frozen instant;
       set() live-tunes what the planner deals next */
    pause: function () {
      if (paused) return;
      paused = true;
      pausedAt = performance.now();
      cancelAnimationFrame(rafId);
    },
    resume: function () {
      if (!paused) return;
      pauseAccum += performance.now() - pausedAt;
      paused = false;
      if (live.length) { cancelAnimationFrame(rafId); frame(); }
    },
    paused: function () { return paused; },
    set: function (o) { if (o && o.stubbornP != null) stubbornP = o.stubbornP; },
    mount: function (host, opt) {
      for (var i = 0; i < timers.length; i++) clearInterval(timers[i]);
      timers = [];
      cancelAnimationFrame(rafId);
      host.innerHTML = '';
      /* setTimeout, NOT requestAnimationFrame: rAF is parked while the tab is
         hidden, so a visitor who opens this in a background tab would come
         back to an empty sheet that never built itself. */
      var tries = 0;
      (function attempt() {
        if (++tries > 60) return;
        if (!host.clientWidth || !host.clientHeight) {
          setTimeout(attempt, 40);
          return;
        }
        build(host, opt);
      })();
    }
  };
})();
