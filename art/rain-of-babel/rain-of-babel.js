/* ============================================================================
   THE CARBON RAIN — standalone piece.

   A falling column of characters in the manner of the film everyone has seen,
   retyped on a municipal office machine: 73 writing systems and five sets of
   notation, 5,987 characters, one glyph to a printed square, falling down the
   ruling of the paper itself.

   THE COLUMN NEVER REPEATS. A stream loops; at the instant it wraps — jumping
   from below the bottom edge back above the top — every square in it is off
   the sheet. That is where the characters are drawn again, so the change is
   never seen and the supply is the whole pool rather than a fixed strip of
   markup. The guard on the listener matters: animationiteration BUBBLES, and
   the pinwheel squares run their own animation inside the same stream.

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
       never on a glyph that is symmetrical about its own vertical axis */
    var rev = MOK[key] && SYM.indexOf(ch) < 0 && Math.random() < 0.18;
    el.className = 'rb-g rb-' + key + (rev ? ' is-rev' : '') +
                   (el.getAttribute('data-spin') || '');
    el.textContent = ch;
  }

  function fill(s) {
    var cells = s.children, n = cells.length, i;
    for (i = 0; i < n; i++) strike(cells[i]);
  }

  function onWrap(e) {
    /* animationiteration BUBBLES. Every pinwheel square inside this stream
       runs its own rbSpin, and those events arrive here too — without this
       guard a column re-rolls whenever one of its pinwheels completes a turn,
       mid-fall and in plain sight. */
    if (e.target !== this || e.animationName !== 'rbFall') return;
    fill(this);
  }


  /* ------------------------------------------------------------------------
     MODE: IMPACT.
     The column falls and is dismantled one character at a time. The lowest
     glyph reaches the bottom rule, breaks off and is thrown; the rest keep
     falling; the next one lands a beat later and goes the same way, until
     the column has been taken apart entirely.

     THE WHOLE THING IS ONE TRAJECTORY, OFFSET IN TIME. Every glyph runs the
     same keyframes — fall at a constant rate to the floor, then be thrown —
     and glyph i is simply delayed by one square's worth of falling
     (CELL / speed). A glyph delayed by one beat sits exactly one square
     higher at every instant, so the COLUMN IS AN ARTEFACT OF THE STAGGER,
     not of any stacking: every glyph is parked at top:0 and the spacing is
     made of time. It also means the bottom of the column dissolves upward on
     its own, with no bookkeeping.

     Because the fall always occupies the same fraction of the cycle
     (IMPACT_AT), one keyframe block serves every column at any period.
     -------------------------------------------------------------------- */
  /* The fall takes up nearly the whole cycle, so what is left for the throw
     is SHORT in absolute time — a burst, not a lob. At 0.88 a seven-second
     fall is followed by a throw lasting under a second. */
  var IMPACT_AT = 0.88;

  /* Gravity, in px/s^2 of screen space, scaled by the zoom so the piece
     behaves the same at any square size. Everything thrown on a sheet falls
     under this one number. */
  var GRAVITY = 2600;

  /* A launch velocity for one glyph, converted into the distances CSS wants:
     --vx / --vy are how far this velocity carries it in one flight, and the
     keyframes multiply those by t and t^2 to trace the real parabola. */
  var REF_SPEED = 33;   /* the fall speed the throw ranges below were tuned at */

  function throwGlyph(g, zoom, flight, spread, fallSpeed) {
    var dir = Math.random() < 0.5 ? -1 : 1;
    /* The column's own momentum goes into what it throws: a faster column
       hits harder. This also keeps the throw looking right as the fall speeds
       up — flight time is a fixed fraction of the cycle, so a quicker column
       has less time in the air, and without this the debris would travel a
       correspondingly shorter distance and the burst would shrink. */
    var punch = (fallSpeed / zoom) / REF_SPEED;
    /* struck from underneath by a column landing on it: mostly sideways,
       with real but modest lift */
    var vx = dir * (90 + Math.random() * spread) * zoom * punch;
    var vy = -(120 + Math.random() * 340) * zoom * punch;
    g.style.setProperty('--vx', (vx * flight).toFixed(1) + 'px');
    g.style.setProperty('--vy', (vy * flight).toFixed(1) + 'px');
    /* spin rate falls off as the throw gets flatter, so fast flat debris
       tumbles less than something lobbed up */
    g.style.setProperty('--r',
      ((Math.random() < 0.5 ? -1 : 1) *
       (120 + Math.random() * 620) * punch * flight).toFixed(0) + 'deg');
  }

  function onGlyphLanded(e) {
    /* this glyph has finished its arc and is about to fall again from the
       top: give it a new character and a new launch velocity */
    if (e.animationName !== 'rbBurst' || e.target !== this) return;
    strike(this);
    throwGlyph(this, this.__zoom, this.__flight, this.__spread, this.__speed);
  }

  function buildImpact(host, opt) {
    opt = opt || {};
    var W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return 0;
    host.style.setProperty('--rb-h', H + 'px');
    var css = getComputedStyle(host);
    var CELL = parseFloat(css.getPropertyValue('--rb-cell')) || 9;
    var zoom = CELL / 9;
    var rows = Math.floor(H / CELL);
    var cols = Math.floor(W / CELL);
    var spread = opt.spread == null ? 620 : opt.spread;   /* px/s of sideways throw */

    var want;
    if (opt.density != null) want = Math.round(cols * Math.max(0, Math.min(1, opt.density)));
    else if (opt.columns != null) want = Math.min(opt.columns, cols);
    else want = cols;

    var picks = [];
    if (want >= cols) {
      for (var c = 0; c < cols; c++) picks.push(c);
    } else if (want === 1) {
      picks.push(cols >> 1);
    } else if (want > 0) {
      /* a shuffled subset, not every nth column: evenly spaced columns read
         as a comb, and rain does not fall in a comb */
      var bag = [];
      for (var c2 = 0; c2 < cols; c2++) bag.push(c2);
      for (var i2 = bag.length - 1; i2 > 0; i2--) {
        var j2 = rnd(i2 + 1), t2 = bag[i2]; bag[i2] = bag[j2]; bag[j2] = t2;
      }
      picks = bag.slice(0, want).sort(function (a, b) { return a - b; });
    }

    var frag = document.createDocumentFragment(), n = 0;
    for (var pi = 0; pi < picks.length; pi++) {
      /* Fall speed. Everything else in the column derives from it: the beat
         between characters breaking off is CELL / speed, and the period is the
         whole fall divided by IMPACT_AT. Raise it and the column both falls
         and dismantles faster. */
      var speed = (48 + Math.random() * 44) * zoom;      /* px per second */
      var lead = CELL * (2 + rnd(6));                    /* run-up, whole squares */
      /* The landing is snapped to the paper's ruling, so the fall distance has
         to be derived FROM that snapped value — not from the sheet height.
         Get this wrong and the beat no longer equals one square of travel, and
         the column's spacing drifts off the grid it is supposed to sit on. */
      var y0 = -(CELL + lead);
      var y1 = Math.floor((H - CELL) / CELL) * CELL;
      var period = ((y1 - y0) / speed) / IMPACT_AT;
      var beat = CELL / speed;                           /* one square of falling */
      /* the whole column has to be dealt inside one period, or the top of it
         wraps into the next cycle and the stack tears */
      var maxLen = Math.floor(period / beat * 0.86);
      var len = 8 + rnd(Math.max(2, Math.min(rows, 26, maxLen) - 8));
      /* how long a thrown character is in the air, and therefore how far
         gravity drops it over that flight: 1/2 g t^2, the same for every
         piece of debris this column throws */
      var flight = period * (1 - IMPACT_AT);
      var gp = 0.5 * GRAVITY * zoom * flight * flight;

      var col = document.createElement('span');
      col.className = 'rb-c rb-burst';
      col.style.left = (picks[pi] * CELL) + 'px';
      col.style.setProperty('--rb-o', (0.62 + Math.random() * 0.38).toFixed(2));
      col.style.setProperty('--y0', y0 + 'px');
      col.style.setProperty('--y1', y1 + 'px');
      col.style.setProperty('--gp', gp.toFixed(1) + 'px');
      var base = -Math.random() * period;
      for (var i = 0; i < len; i++) {
        var g = document.createElement('i');
        /* i beats of delay puts this glyph i squares higher, permanently */
        g.style.animationDelay = (base - i * beat).toFixed(3) + 's';
        g.style.animationDuration = period.toFixed(3) + 's';
        g.__zoom = zoom; g.__spread = spread; g.__flight = flight;
        g.__speed = speed;
        strike(g);
        throwGlyph(g, zoom, flight, spread, speed);
        g.addEventListener('animationiteration', onGlyphLanded);
        col.appendChild(g);
      }
      frag.appendChild(col);
      n++;
    }
    host.appendChild(frag);
    if (opt.onBuilt) opt.onBuilt(n, cols);
    return n;
  }

  /* ------------------------------------------------------------------------
     MODE: PILE.
     The debris is not thrown away — it is thrown, it bounces off the walls if
     it reaches them, and it comes to rest WHERE IT LANDS and stays there. The
     drift builds out of overlapping characters lying at all angles, not out of
     tidy stacks.

     This sheet does NOT use the shared CSS keyframes the other two do, and it
     cannot: a bounce is piecewise, and x = vx*t has no way to express one. So
     the flight is integrated here, step by step, reflected off the walls when
     it gets to them, and stopped when it meets the surface of the drift — and
     the resulting path is handed to element.animate() as sampled keyframes.
     Same physics as the impact sheet, simulated rather than solved.

     The drift is a HEIGHT FIELD, not a grid of columns: buckets a third of a
     square wide, each holding the height of whatever is lying there. A
     character rests on the highest bucket under its own width and then raises
     those buckets by only about half its height, so the next one to land sits
     INTO it rather than on top of it. That overlap is what makes a heap look
     like a heap.
     -------------------------------------------------------------------- */
  var PILE_BUCKET = 3;        /* buckets per square */
  var PILE_OVERLAP = 0.52;    /* how deep the next character nests in */
  var FLIGHT_ALLOWANCE = 1.1;  /* seconds a thrown glyph may stay in the air */
  var BOUNCE = 0.46;          /* speed kept after hitting a wall */
  var PILE_STEPS = 600;       /* integration cap: 10s of flight at 60 steps/s */

  function surfaceAt(st, x, w) {
    var b0 = Math.max(0, Math.floor(x / st.bw));
    var b1 = Math.min(st.top.length - 1, Math.floor((x + w) / st.bw));
    var y = st.H;
    for (var b = b0; b <= b1; b++) if (st.top[b] < y) y = st.top[b];
    return y;
  }
  function depositAt(st, x, w, restY) {
    var b0 = Math.max(0, Math.floor(x / st.bw));
    var b1 = Math.min(st.top.length - 1, Math.floor((x + w) / st.bw));
    var newTop = restY + st.CELL * st.overlap;
    for (var b = b0; b <= b1; b++) if (newTop < st.top[b]) st.top[b] = newTop;
  }

  /* Integrate one flight: launched from (x0, y0), pulled down by gravity,
     reflected off the side walls, stopped by the surface of the drift.
     Returns the sampled path and where it came to rest. */
  function flyPath(st, x0, y0, vx, vy, g, dt, maxSteps) {
    var pts = [{ x: x0, y: y0 }], x = x0, y = y0, i;
    for (i = 0; i < maxSteps; i++) {
      vy += g * dt;
      x += vx * dt;
      y += vy * dt;
      if (x <= 0)            { x = -x; vx = -vx * st.bounce; }
      else if (x >= st.W - st.CELL) { x = 2 * (st.W - st.CELL) - x; vx = -vx * st.bounce; }
      var floorY = surfaceAt(st, x, st.CELL) - st.CELL;
      if (y >= floorY && vy > 0) { y = floorY; pts.push({ x: x, y: y }); break; }
      pts.push({ x: x, y: y });
    }
    return pts;
  }

  /* Which columns of the paper are spoken for. A run keeps its slot until
     the last of its characters has cleared, so a new run never starts on top
     of one that is still falling. */
  /* A lane is available only if BOTH are true: no run has reserved it, and
     nothing is actually falling in it.

     Reservation alone is not enough. Slots are handed out ahead of time —
     col.__next is a future moment — so a run stops reserving a lane while its
     characters are still on their way down it. Predicting when that lane goes
     quiet from the schedule is a guess, and getting it wrong puts two runs in
     one column. So occupancy is COUNTED instead: incremented when a character
     is launched into a lane, decremented when it comes to rest. */
  function laneFree(st, i) { return !st.busy[i] && !st.lane[i]; }

  function claimSlot(st, owner, avoid) {
    var free = [];
    for (var i = 0; i < st.cols; i++) if (laneFree(st, i)) free.push(i);
    if (!free.length) {
      /* nothing spare, so this run keeps the lane it is in — and must
         RE-RESERVE it. relocate() has already cleared the reservation by the
         time this is called, and returning without restoring it leaves the run
         falling in a lane it no longer holds, which is exactly how two runs
         end up sharing one. */
      st.busy[avoid] = owner;
      return avoid;
    }
    var pick = free[rnd(free.length)];
    st.busy[pick] = owner;
    return pick;
  }

  /* a run has finished entering: hand back its slot once its characters have
     had time to land, and take a different one for the next run */
  function relocate(col) {
    var st = col.__st;
    /* stop reserving the old lane; it stays occupied, and so unavailable,
       until the last character actually falling in it has come to rest */
    if (st.busy[col.__c] === col) st.busy[col.__c] = null;
    col.__c = claimSlot(st, col, col.__c);
    col.__x = col.__c * st.CELL;
  }

  function buildPile(host, opt) {
    opt = opt || {};
    var W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return 0;
    var css = getComputedStyle(host);
    var CELL = parseFloat(css.getPropertyValue('--rb-cell')) || 9;
    var zoom = CELL / 9;
    var cols = Math.floor(W / CELL);
    var rows = Math.floor(H / CELL);

    /* Every number that shapes this sheet is a dial now. The multipliers are
       all 1 at the tuned defaults, so an unadorned mount behaves exactly as
       the piece always has — except that these are also LIVE: runGlyph and
       flyPath read them off st at launch time, so tunePile() can turn them
       mid-flight without a rebuild. */
    var spdMul = opt.speed == null ? 1 : opt.speed;
    var runMul = opt.run == null ? 1 : opt.run;
    var gapMul = opt.gap == null ? 1 : opt.gap;
    var st = {
      W: W, H: H, CELL: CELL, zoom: zoom, cols: cols, rows: rows,
      bw: CELL / PILE_BUCKET,
      top: [],
      floorLimit: H - rows * CELL * (opt.maxFill == null ? 0.72 : opt.maxFill),
      cap: opt.cap == null ? 2600 : opt.cap,
      overlap: opt.overlap == null ? PILE_OVERLAP : opt.overlap,
      bounce: opt.bounce == null ? BOUNCE : opt.bounce,
      gravity: GRAVITY * (opt.gravity == null ? 1 : opt.gravity),
      throwX: opt.throwX == null ? 1 : opt.throwX,
      popY: opt.popY == null ? 1 : opt.popY,
      spinMul: opt.spin == null ? 1 : opt.spin,
      n: 0, clearing: false, columns: [], busy: {}, lane: {}
    };
    for (var i = 0; i < Math.ceil(W / st.bw) + 1; i++) st.top.push(H);

    var pile = document.createElement('span');
    pile.className = 'rb-pile';
    host.appendChild(pile);
    st.layer = pile;

    var want = opt.density != null
      ? Math.round(cols * Math.max(0, Math.min(1, opt.density))) : cols;
    var bag = [];
    for (var c2 = 0; c2 < cols; c2++) bag.push(c2);
    for (var i2 = bag.length - 1; i2 > 0; i2--) {
      var j2 = rnd(i2 + 1), t2 = bag[i2]; bag[i2] = bag[j2]; bag[j2] = t2;
    }
    var picks = bag.slice(0, Math.max(1, want)).sort(function (a, b) { return a - b; });

    var frag = document.createDocumentFragment();
    for (var pi = 0; pi < picks.length; pi++) {
      var c = picks[pi];
      var speed = (48 + Math.random() * 44) * zoom * spdMul;
      var lead = CELL * (2 + rnd(6));
      /* claimed below, once the column element exists to own it */
      var pileTop0 = surfaceAt(st, c * CELL, CELL) - CELL;
      var col = document.createElement('span');
      /* the container spans the whole sheet now; the x of a run belongs to
         the LAUNCH, so a run can enter somewhere else while the previous one
         is still on its way down */
      col.className = 'rb-c rb-drop';
      col.style.setProperty('--rb-o', (0.66 + Math.random() * 0.34).toFixed(2));
      col.__c = c; col.__x = c * CELL; col.__st = st; col.__speed = speed;
      col.__y0 = -(CELL + lead);
      var beat = CELL / speed;
      col.__beat = beat * 1000;
      /* One cursor per column, moved on one beat at a time. The spacing in a
         falling column comes from launches being exactly one square of travel
         apart — it CANNOT come from a fixed per-glyph delay any more, because
         the fall gets shorter as the drift rises and every glyph's flight is
         a different length. Restarting a glyph with no delay (which is what
         used to happen after its first landing) collapses the whole column
         into one clump. */
      col.__next = performance.now() + Math.random() * beat * 1000;

      /* HOW MANY GLYPHS A COLUMN NEEDS.
         It launches one per beat, and a glyph is not available again until it
         has fallen AND flown. So the pool has to cover a whole round trip:
         fewer than that and the queue starves, the launch cursor is dragged
         back to `now`, and a gap opens at some arbitrary point in the column.
         That was the inconsistent spacing — the schedule was right, there was
         simply nothing left to launch. */
      /* THE COLUMN'S OWN LENGTH — a fixed run of characters, then a gap,
         then another run. This is a property of the SCHEDULE, not of how many
         glyph elements exist: the cursor lays down __block launches one beat
         apart and then skips __gap of them. Letting the pool size decide the
         length instead is what turned every column into an endless stream. */
      col.__block = Math.max(2, Math.round((7 + rnd(18)) * runMul));
      col.__gap = (2 + rnd(7)) * beat * 1000 * gapMul;
      col.__launched = 0;
      col.__fallMs = (pileTop0 - (-(CELL + lead))) / speed * 1000;
      st.busy[c] = col;

      /* the pool only has to cover a round trip — fall, flight, and back to
         the top. The gaps make it easier, so this stays conservative. A
         higher loft or a weaker gravity keeps the debris in the air longer,
         so the allowance grows with the time a full up-and-down at the top
         of the launch range actually takes: 2 * vy_max / g. */
      var fallSec = (pileTop0 - col.__y0) / speed;
      var flightSec = FLIGHT_ALLOWANCE + 740 * st.popY / st.gravity;
      var len = Math.min(80, Math.ceil((fallSec + flightSec) / beat) + 3);
      for (var k = 0; k < len; k++) {
        var g = document.createElement('i');
        g.__col = col;
        strike(g);
        col.appendChild(g);
        runGlyph(g);
      }
      st.columns.push(col);
      frag.appendChild(col);
    }
    host.appendChild(frag);
    host.__pile = st;
    startReaper(host, st);
    if (opt.onBuilt) opt.onBuilt(picks.length, cols);
    return picks.length;
  }

  /* one glyph: fall, land, be thrown, bounce, come to rest — then leave a
     copy of itself lying there and go back to the top */
  function runGlyph(g) {
    var col = g.__col, st = col.__st;

    /* THE SLOT COMES FIRST. Where this character enters decides where it
       lands, how far it falls and what it is thrown over, so the schedule has
       to be settled before any of the flight is worked out. */
    var now = performance.now();
    if (col.__next < now) {
      /* the queue ran dry: the pool is too small for this column's round
         trip, and the stream will show a gap here. Counted rather than
         silently corrected, so the sizing can be checked. */
      col.__starved = (col.__starved || 0) + 1;
      col.__next = now;
    }
    var wait = col.__next - now;
    col.__next += col.__beat;
    col.__launched++;
    /* captured BEFORE any relocation: this character belongs to the run that
       is entering now, not to the one that starts after the break */
    var x0 = col.__x;
    if (col.__launched % col.__block === 0) {
      col.__next += col.__gap;
      relocate(col);
    }
    g.style.left = x0 + 'px';
    /* this character now occupies that lane until it comes to rest */
    g.__lane = Math.round(x0 / st.CELL);
    st.lane[g.__lane] = (st.lane[g.__lane] || 0) + 1;

    var impactY = surfaceAt(st, x0, st.CELL) - st.CELL;
    var fallMs = (impactY - col.__y0) / col.__speed * 1000;

    /* Launch. Deliberately gentler than the impact sheet: there the point is
       debris leaving the frame, here it is debris coming to rest nearby, and
       a hard throw scatters everything to the walls instead of building a
       heap where the column actually fell. */
    var vx = (Math.random() < 0.5 ? -1 : 1) * (95 + Math.random() * 430) * st.zoom * st.throwX;
    var vy = -(115 + Math.random() * 255) * st.zoom * st.popY;
    var dt = 1 / 60;
    var pts = flyPath(st, x0, impactY, vx, vy, st.gravity * st.zoom, dt, PILE_STEPS);
    var flightMs = (pts.length - 1) * dt * 1000;
    var spin = (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 420) * st.spinMul;

    var frames = [{ transform: 'translate(0px,' + col.__y0 + 'px) rotate(0deg)',
                    offset: 0, easing: 'linear' }];
    var total = fallMs + flightMs;
    frames.push({ transform: 'translate(0px,' + impactY + 'px) rotate(0deg)',
                  offset: fallMs / total, easing: 'linear' });
    for (var i = 1; i < pts.length; i++) {
      var f = i / (pts.length - 1);
      frames.push({
        transform: 'translate(' + (pts[i].x - x0).toFixed(1) + 'px,' +
                   pts[i].y.toFixed(1) + 'px) rotate(' + (spin * f).toFixed(0) + 'deg)',
        offset: Math.min(1, (fallMs + f * flightMs) / total),
        easing: 'linear'
      });
    }
    var rest = pts[pts.length - 1];
    g.__rest = { x: rest.x, y: rest.y, rot: spin };

    if (g.__anim) g.__anim.cancel();
    /* NOT anim.onfinish: this WebView never dispatches finish events while the
       page is hidden — verified, even for a trivial animation with finish()
       called on it directly. Hanging the drift's whole lifecycle on that event
       means a visitor who switches tabs comes back to a sheet that has quietly
       stopped working. The reaper below polls playState instead, which is true
       whether or not any event was delivered. */
    /* fill BOTH, not backwards. Backwards alone holds the first keyframe
       during the wait but releases the element the moment the flight ends —
       and until the reaper picks it up (up to a poll apart) it snaps back to
       its base css, which puts it at the top edge of the sheet in plain view.
       That was the flashing along the top rule. */
    g.__anim = g.animate(frames,
      { duration: total, delay: wait, fill: 'both' });
  }

  /* one timer per sheet, collecting whatever has come to rest since last look */
  function startReaper(host, st) {
    if (host.__reaper) clearInterval(host.__reaper);
    host.__reaper = setInterval(function () {
      var gl = host.querySelectorAll('.rb-drop > i');
      for (var i = 0; i < gl.length; i++) {
        var a = gl[i].__anim;
        if (a && a.playState === 'finished') onPileLanded(gl[i]);
      }
    }, 90);
  }

  function onPileLanded(g) {
    var col = g.__col, st = col.__st, r = g.__rest;
    /* out of its lane. Decremented here and incremented in runGlyph, exactly
       once each per launch, so the count cannot drift. */
    if (g.__lane != null && st.lane[g.__lane]) st.lane[g.__lane]--;
    st.calls = (st.calls || 0) + 1;
    if (st.clearing) st.skipClearing = (st.skipClearing || 0) + 1;
    else if (st.n >= st.cap) st.skipCap = (st.skipCap || 0) + 1;
    else if (!(r.y > st.floorLimit)) st.skipFloor = (st.skipFloor || 0) + 1;
    if (!st.clearing && st.n < st.cap && r.y > st.floorLimit) {
      var d = document.createElement('i');
      d.className = g.className;
      d.textContent = g.textContent;
      d.style.left = r.x.toFixed(1) + 'px';
      d.style.top = r.y.toFixed(1) + 'px';
      /* lying at whatever angle it stopped at, plus a little */
      d.style.transform = 'rotate(' + (r.rot % 360 + (rnd(21) - 10)).toFixed(0) + 'deg)';
      st.layer.appendChild(d);
      depositAt(st, r.x, st.CELL, r.y);
      st.n++;
      /* Sweep on the AVERAGE depth, not the highest point. surfaceAt returns
         the minimum top across its span, so the old test cleared the floor as
         soon as a single spike reached the limit — with most of the sheet
         still bare. The drift should be broadly full before it goes. */
      if (st.n >= st.cap || meanTop(st) <= st.floorLimit) sweepPile(st);
    }
    strike(g);
    runGlyph(g);
  }

  function meanTop(st) {
    var sum = 0;
    for (var i = 0; i < st.top.length; i++) sum += st.top[i];
    return sum / st.top.length;
  }

  function sweepPile(st) {
    if (st.clearing) return;
    st.clearing = true;
    st.layer.classList.add('is-going');
    setTimeout(function () {
      st.layer.innerHTML = '';
      st.layer.classList.remove('is-going');
      for (var i = 0; i < st.top.length; i++) st.top[i] = st.H;
      st.n = 0;
      st.clearing = false;
    }, 2200);
  }

  function build(host, opt) {
    opt = opt || {};
    var W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return 0;
    /* CSS owns the zoom: --rb-cell is the square every glyph sits in, and the
       same value rules the paper. Reading it here means the two cannot drift. */
    var css = getComputedStyle(host);
    var CELL = parseFloat(css.getPropertyValue('--rb-cell')) || 9;
    var zoom = CELL / 9;
    /* --rb-h is the SHEET's height. A percentage in translateY resolves
       against the ELEMENT's own height, so 100% here would move a stream by
       its own length and wrap it in full view, mid-sheet. */
    host.style.setProperty('--rb-h', H + 'px');
    var spinP = opt.spinP == null ? 0.06 : opt.spinP;
    var rows = Math.floor(H / CELL);
    var frag = document.createDocumentFragment(), streams = [];
    var allCols = Math.floor(W / CELL);
    /* which columns rain at all. A shuffled subset, not every nth one — an
       even comb does not read as rain. */
    var live = null;
    if (opt.density != null && opt.density < 1) {
      var bag = [], i0;
      for (i0 = 0; i0 < allCols; i0++) bag.push(i0);
      for (i0 = bag.length - 1; i0 > 0; i0--) {
        var j0 = rnd(i0 + 1), t0 = bag[i0]; bag[i0] = bag[j0]; bag[j0] = t0;
      }
      live = {};
      bag.slice(0, Math.round(allCols * Math.max(0, opt.density)))
         .forEach(function (v) { live[v] = 1; });
    }
    for (var c = 0; c < allCols; c++) {
      if (live && !live[c]) continue;
      /* every column carries a stream; the gaps in the rain are made by a
         run-up above the sheet, so a column empties and fills again on its own
         cycle rather than being dealt empty and staying blank */
      var col = document.createElement('span');
      col.className = 'rb-c';
      col.style.left = (c * CELL) + 'px';
      col.style.setProperty('--rb-o', (0.62 + Math.random() * 0.38).toFixed(2));
      var ndrop = Math.random() < 0.38 ? 2 : 1;
      var len = 8 + rnd(Math.max(2, Math.min(rows, 46) - 8));
      var body = len * CELL;
      var lead = body + Math.round(body * (0.10 + Math.random() * 1.30));
      var travel = H + lead;
      /* scaled by the zoom so the rain always falls at the same number of
         SQUARES per second, whatever size the squares are */
      var d = travel / ((22 + Math.random() * 20) * zoom);
      var base = Math.random() * d;
      for (var s = 0; s < ndrop; s++) {
        var st = document.createElement('span');
        st.className = 'rb-s';
        st.style.setProperty('--rb-dh', lead + 'px');
        st.style.setProperty('--rb-d', d.toFixed(2) + 's');
        var ph = (base + s * d / 2) % d;
        st.style.setProperty('--rb-dl', (-ph).toFixed(2) + 's');
        st.style.setProperty('--rb-y0', Math.round(-lead + travel * ph / d) + 'px');
        for (i = 0; i < len; i++) {
          var cell = document.createElement('i');
          if (Math.random() < spinP) {
            cell.setAttribute('data-spin',
              ' is-spin' + (Math.random() < 0.5 ? ' is-ccw' : ''));
            cell.style.setProperty('--rb-sd', (4 + Math.random() * 7).toFixed(2) + 's');
          }
          st.appendChild(cell);
        }
        fill(st);
        st.addEventListener('animationiteration', onWrap);
        col.appendChild(st);
        streams.push(st);
      }
      frag.appendChild(col);
    }
    host.appendChild(frag);
    if (opt.onBuilt) opt.onBuilt(host.querySelectorAll('.rb-c').length, allCols);
    /* the slow in-view re-strike: a few squares a second, caught out of the
       corner of an eye rather than watched */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var rate = opt.visibleRate == null ? 10 : opt.visibleRate;
      /* the interval is kept ON THE HOST, not in a module-level list: this
         page mounts two sheets, and a shared list means mounting the second
         would clear the first one's re-strike. */
      host.__restrike = function () {
        if (host.__rbTimer) clearInterval(host.__rbTimer);
        host.__rbTimer = setInterval(tick, 1000);
      };
      var tick = function () {
        for (var i = 0; i < rate; i++) {
          var st = streams[rnd(streams.length)];
          if (!st) continue;
          var cell = st.children[rnd(st.children.length)];
          if (cell) strike(cell);
        }
      };
      host.__restrike();
    }
    return streams.length;
  }

  /* Re-tune a mounted pile sheet WITHOUT rebuilding it. Only the numbers the
     physics reads at launch time can move this way — how a glyph is thrown,
     how it falls, how it nests, when the drift sweeps. The shape of the rain
     itself (which columns, how fast, in what runs) is baked into the columns
     at build and needs a fresh mount. */
  function tunePile(host, opt) {
    var st = host.__pile;
    if (!st || !opt) return false;
    if (opt.throwX != null) st.throwX = opt.throwX;
    if (opt.popY != null) st.popY = opt.popY;
    if (opt.spin != null) st.spinMul = opt.spin;
    if (opt.bounce != null) st.bounce = opt.bounce;
    if (opt.gravity != null) st.gravity = GRAVITY * opt.gravity;
    if (opt.overlap != null) st.overlap = opt.overlap;
    if (opt.cap != null) st.cap = opt.cap;
    if (opt.maxFill != null) st.floorLimit = st.H - st.rows * st.CELL * opt.maxFill;
    return true;
  }

  /* Pausing has to reach two different mechanisms: the fall and impact sheets
     run on CSS animations, the pile sheet on the Web Animations API with a
     timer collecting what has landed. One switch, both handled. */
  function setPaused(host, want) {
    host.__paused = !!want;
    host.classList.toggle('is-paused', !!want);
    var gl = host.querySelectorAll('.rb-drop > i'), i;
    for (i = 0; i < gl.length; i++) {
      var a = gl[i].__anim;
      if (!a) continue;
      try { want ? a.pause() : a.play(); } catch (e) {}
    }
    /* the reaper must stop too, or a paused sheet keeps harvesting whatever
       was already finished and the drift grows while it is meant to be still */
    if (want) {
      if (host.__reaper) { clearInterval(host.__reaper); host.__reaper = null; }
    } else if (host.__pile && !host.__reaper) {
      startReaper(host, host.__pile);
    }
    if (host.__rbTimer) { clearInterval(host.__rbTimer); host.__rbTimer = null; }
    if (!want && host.__restrike) host.__restrike();
  }

  window.RainOfBabel = {
    setPaused: setPaused,
    tune: tunePile,
    isPaused: function (host) { return !!host.__paused; },
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
    mount: function (host, opt) {
      if (host.__rbTimer) { clearInterval(host.__rbTimer); host.__rbTimer = null; }
      if (host.__reaper) { clearInterval(host.__reaper); host.__reaper = null; }
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
        (opt && opt.mode === 'pile' ? buildPile
         : opt && opt.mode === 'impact' ? buildImpact : build)(host, opt);
      })();
    }
  };
})();
