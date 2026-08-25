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
    /* the pile sheet paints its deposits itself and needs the script key
       back to look up the size the CSS would have used */
    el.__rbKey = key;
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
     it gets to them, and brought to rest against the surface of the drift —
     bouncelet and skid included, contact by contact — and the resulting path
     is handed to element.animate() as sampled keyframes. Same physics as the
     impact sheet, simulated rather than solved.

     The drift is a HEIGHT FIELD, not a grid of columns: buckets a third of a
     square wide, each holding the height of whatever is lying there. A
     character rests on the highest bucket under its own width and then raises
     those buckets by only about half its height, so the next one to land sits
     INTO it rather than on top of it. That overlap is what makes a heap look
     like a heap.
     -------------------------------------------------------------------- */
  var PILE_BUCKET = 3;        /* buckets per square */
  var PILE_OVERLAP = 0.52;    /* how deep the next character nests in */
  /* seconds a thrown glyph may stay in motion. This covers the ground time
     now as well as the air time: a fragment that skids, and one that sat a
     beat before breaking, both take longer to come home than a pure lob. */
  var FLIGHT_ALLOWANCE = 1.8;
  var BOUNCE = 0.46;          /* speed kept after hitting a wall */
  var PILE_STEPS = 600;       /* integration cap: 10s of flight at 60 steps/s */
  /* The fall speed the pile's throw ranges are tuned at — the MIDDLE of this
     sheet's own launch range at the shipped speed dial, so the default feel
     is exactly the tuned one and only a re-dialled fall moves the punch. The
     impact sheet's REF_SPEED is 33 and would double every throw here. */
  var PUNCH_REF = 66;
  /* Ploughing: extra slide drag that grows with the SQUARE of the speed, so
     a fast skidder digs in and brakes hard while a slow glide barely feels
     it. Without this the rare energetic fragment crosses half the sheet —
     stopping distance under plain friction is quadratic in speed, so the
     outliers that make the energy range read also, untreated, leave the
     scene of the crash entirely. Per px at zoom 1; flyPath divides by zoom. */
  var PLOUGH = 0.01;
  /* GRAVITY ALONG THE GROUND. The slide used to move at its launch speed
     minus friction while its y merely FOLLOWED the height field — the slope
     was scenery, not a force, and debris climbed a 37-degree flank exactly
     as far as it ran down one (measured: matched slides, ratio 1.0-1.4,
     zero uphill turn-backs). Now the local gradient pulls: the tangential
     share of the glyph's own gravity, g*s/(1+s^2). Not at full strength —
     heap friction here is an absolute deceleration, so the full physical
     pull collapses the angle of repose to ~6 degrees and turns most slides
     into luge runs to the slide cap (measured: 67-100% on 10-degree-plus
     grades). Letters interlock instead:
       DEAD  — grades under ~6 degrees stay exactly the tuned flat feel;
       HOLD  — static repose ~29 degrees: a STOPPED letter keeps its footing
               on anything gentler, and only re-slides past it;
       GAIN  — the fraction of the physical pull a MOVING letter feels;
       CLAMP — gradient cap ~50 degrees, so a jagged spike in the ledger
               cannot inject an impulse. */
  var SLOPE_DEAD  = 0.10;
  var SLOPE_HOLD  = 0.55;
  var SLOPE_GAIN  = 0.65;
  var SLOPE_CLAMP = 1.2;
  var DUST_POOL = 80;         /* dust marks per sheet, pre-made, recycled —
                                 sized so full default rain (~15 landings/s)
                                 does not run the pool dry */
  var DUST = '·.,';      /* what dust is printed as */

  function surfaceAt(st, x, w) {
    /* HALF-OPEN on the right: [x, x+w). A cell is exactly three buckets and
       every lane is cell-aligned, so the old closed endpoint — floor((x+w)/bw)
       — swept in a whole bucket to the RIGHT of the glyph on every read and
       write. That loaded the coin: deposits smeared their footprint right,
       crest reads told a letter the ground fell away rightward, and the
       right side of every run outgrew the left (owner, 2026-08-24: dozens
       of runs, never once left-heavy). ceil-1 equals floor everywhere except
       exactly on a boundary, which is precisely where it must exclude. */
    var b0 = Math.max(0, Math.floor(x / st.bw));
    var b1 = Math.min(st.top.length - 1, Math.max(b0, Math.ceil((x + w) / st.bw) - 1));
    var y = st.H;
    for (var b = b0; b <= b1; b++) if (st.top[b] < y) y = st.top[b];
    return y;
  }
  /* The MEAN of the span, not its highest point. A glyph that rests on the
     single tallest bucket under it perches there, and its deposit then hoists
     every neighbouring bucket to its own height — spires propagate sideways
     and the drift grows tall on trapped air (measured: ~960 letters holding
     up a 22-square field, under one letter per square). Resting on the mean
     lets a letter settle INTO the hollows between spikes, which is what a
     thrown thing does, and is what makes the heap read as packed. */
  function surfaceMeanAt(st, x, w) {
    var b0 = Math.max(0, Math.floor(x / st.bw));
    var b1 = Math.min(st.top.length - 1, Math.max(b0, Math.ceil((x + w) / st.bw) - 1));
    var sum = 0, n = 0;
    for (var b = b0; b <= b1; b++) { sum += st.top[b]; n++; }
    return n ? sum / n : st.H;
  }
  /* The eye reads INK, not boxes: a glyph's ink fills only ~63% of its cell,
     with ~4.5px of air inside the box below the striker's ink and ~3px above
     the pile top's (measured over 447 char/class pairs, 2026-08-24). A lift
     of the full nesting depth aligns box-bottom to box-top, and the strike
     registers a third of a square above visible contact. The slack closes
     that gap; a CELL fraction, so it scales with the zoom. */
  var INK_SLACK = 0.32;
  /* A crossing the reaper only noticed after the fact (a missed tick, or a
     drift risen over a slow faller mid-air) breaks from the detected y,
     capped this far past the floor. The same kind of measured number as
     the slack above: at 0.3 of a cell, point and crush starts at depth ran
     to +8px into the ink (p90); 0.2 brings them back inside the ink
     model's own spread. The predictive pre-roll never touches this — it is
     the fallback path's leash only. */
  var LATE_CAP = 0.2;

  /* Where the EYE says the drift's top is — the floor a falling thing should
     STRIKE. The height field is a growth ledger: a deposit raises it by only
     (1 - nesting) of a square, so with deep nesting the recorded surface
     sits almost a whole square below the tops of the letters actually lying
     there — and a column that falls to the ledger visibly drifts INTO the
     heap before breaking (owner, 2026-08-24: about one grid square, which
     is nesting x cell, exactly). The strike floor lifts the ledger back by
     the nesting depth LESS the ink slack — boxes overlap where ink only
     touches — and only where letters lie: the bare rule is exactly where it
     says it is. Resting and depositing keep the ledger — that nesting-deep
     settle after the break is the packed look itself. */
  function strikeFloorAt(st, x, w) {
    var s = surfaceMeanAt(st, x, w);
    var lift = Math.max(0, st.CELL * (st.overlap - INK_SLACK));
    return (s < st.H - 0.5 ? s - lift : s) - st.CELL;
  }
  /* The PER-CHARACTER strike floor: where THIS glyph's own ink meets the
     ink actually lying under its lane. The constant slack above centers
     contact but cannot remove the per-character spread — ink fills only
     ~63% of the cell, with 3.5-8.5px of air below it, so a narrow-ink
     glyph should fall visibly deeper than a full-height one before it
     shatters. The mean of the ink ledger over the span (the same read
     shape as surfaceMeanAt), less the striker's cached ink bottom. The
     bare rule and every no-data case — blank ink, no 2d context — fall
     back to the constant-slack floor and behave exactly as before. */
  function strikeFloorFor(st, g) {
    if (g.__inkBot != null) {
      var b0 = Math.max(0, Math.floor(g.__x0 / st.bw));
      var b1 = Math.min(st.inkTop.length - 1,
                        Math.max(b0, Math.ceil((g.__x0 + st.CELL) / st.bw) - 1));
      var sum = 0, n = 0;
      for (var b = b0; b <= b1; b++) { sum += st.inkTop[b]; n++; }
      var m = n ? sum / n : st.H;
      if (m < st.H - 0.5) return m - g.__inkBot;
    }
    return strikeFloorAt(st, g.__x0, st.CELL);
  }
  /* the gradient under a point: d(top)/dx over a two-cell central
     difference of bucket MEANS, positive where the ground falls away to
     the right. Each read is itself a three-bucket mean, so a five-bucket
     window smooths every lookup; the clamp is the spike guard. */
  function slopeAt(st, x) {
    var l = surfaceMeanAt(st, x - st.CELL, st.CELL);
    var r = surfaceMeanAt(st, x + st.CELL, st.CELL);
    var s = (r - l) / (2 * st.CELL);
    return s > SLOPE_CLAMP ? SLOPE_CLAMP : s < -SLOPE_CLAMP ? -SLOPE_CLAMP : s;
  }
  /* the fall line under a point: which side of it the ground is lower on.
     Two ledger reads a cell out either side; a tie is a coin. */
  function downhillDir(st, x) {
    var l = surfaceMeanAt(st, x - st.CELL, st.CELL);
    var r = surfaceMeanAt(st, x + st.CELL, st.CELL);
    if (Math.abs(l - r) < 1) return Math.random() < 0.5 ? -1 : 1;
    return r > l ? 1 : -1;
  }
  function depositAt(st, x, w, restY) {
    var b0 = Math.max(0, Math.floor(x / st.bw));
    var b1 = Math.min(st.top.length - 1, Math.max(b0, Math.ceil((x + w) / st.bw) - 1));
    var newTop = restY + st.CELL * st.overlap;
    for (var b = b0; b <= b1; b++) if (newTop < st.top[b]) st.top[b] = newTop;
  }

  /* Integrate one flight: launched from (x0, y0), pulled down by gravity,
     reflected off the side walls. Returns the sampled path and where it came
     to rest.

     MEETING THE GROUND NO LONGER STOPS IT DEAD. A fragment used to end at
     first contact, so all of its sideways energy simply vanished — at a low
     loft the whole burst fit inside two display frames and read as a
     teleport. Now contact spends the energy where it can be SEEN: arriving
     fast enough it takes a bouncelet or two (low restitution, sideways speed
     taxed each hit), and below that it SLIDES along the surface under a
     per-fragment friction until the speed is gone. The slide follows the
     height field downhill, stops against a bank taller than half a square,
     and goes airborne again off an edge taller than most of one — a skid off
     the top of the heap ends as a drop down its side, not a hover.
     imp carries the contact numbers {maxB, e, vB, fric}; the wall bounce
     stays the dial's. PILE_STEPS still caps the whole path, so the worst
     case is what it always was. */
  function flyPath(st, x0, y0, vx, vy, g, dt, maxSteps, imp) {
    var pts = [{ x: x0, y: y0 }], x = x0, y = y0, i;
    var bounces = imp ? imp.maxB : 0;
    var eB = imp ? imp.e : 0.28;
    var vB = imp ? imp.vB : 150 * st.zoom;
    var fric = imp ? imp.fric : 500 * st.zoom;
    var sliding = false, slid = 0;
    for (i = 0; i < maxSteps; i++) {
      if (!sliding) {
        vy += g * dt;
        x += vx * dt;
        y += vy * dt;
        if (x <= 0)            { x = -x; vx = -vx * st.bounce; }
        else if (x >= st.W - st.CELL) { x = 2 * (st.W - st.CELL) - x; vx = -vx * st.bounce; }
        var floorY = surfaceMeanAt(st, x, st.CELL) - st.CELL;
        if (y >= floorY && vy > 0) {
          y = floorY;
          if (bounces > 0 && vy > vB) { bounces--; vy = -vy * eB; vx *= 0.7; }
          else {
            /* the arrival keeps the tangential share of its velocity: a
               lob landing on a flank runs on downhill instead of having
               its vy simply discarded. On flat ground this is exactly the
               old vx. */
            var sL = slopeAt(st, x);
            vx = (vx + 0.8 * sL * vy) / (1 + sL * sL);
            sliding = true; vy = 0;
          }
        }
      } else {
        /* the pull along the ground. Dead-zoned so gentle grades keep the
           tuned flat feel; g is this flight's own gravity, so the Gravity
           dial reaches the slide with no extra wiring. */
        var s = slopeAt(st, x);
        var sEff = s > 0 ? Math.max(0, s - SLOPE_DEAD) : Math.min(0, s + SLOPE_DEAD);
        vx += SLOPE_GAIN * g * sEff / (1 + sEff * sEff) * dt;
        x += vx * dt;
        if (x <= 0)            { x = -x; vx = -vx * st.bounce; }
        else if (x >= st.W - st.CELL) { x = 2 * (st.W - st.CELL) - x; vx = -vx * st.bounce; }
        var f = surfaceMeanAt(st, x, st.CELL) - st.CELL;
        if (f > y + st.CELL * 0.9)      { sliding = false; vy = 0; }
        else if (f < y - st.CELL * 0.55) { x = pts[pts.length - 1].x; pts.push({ x: x, y: y }); break; }
        else y = f;
        /* a toboggan has a story's worth of runway and no more: the rare
           fast fragment on a long downslope was crossing most of the sheet
           (44 cells seen), which stops being an impact and becomes an act */
        slid += Math.abs(vx) * dt;
        if (slid > st.CELL * 13) { pts.push({ x: x, y: y }); break; }
        var dv = (fric + PLOUGH * vx * vx / st.zoom) * dt;
        if (Math.abs(vx) <= dv) {
          /* friction has it — but a grade past repose does not get to
             keep it unless the pull is genuinely weaker than the ground's
             grip. The |gT| clause is load-bearing, not caution: at a low
             Gravity dial the pull above repose can fall under the
             friction, and without it the path pads out with seconds of
             standing still — vx pinned to zero, the lane held the whole
             time. Weak gravity simply rests. */
          var gT = SLOPE_GAIN * g * sEff / (1 + sEff * sEff);
          if (Math.abs(s) <= SLOPE_HOLD || Math.abs(gT) <= fric) {
            pts.push({ x: x, y: y }); break;
          }
          vx = 0;
        } else vx -= dv * (vx > 0 ? 1 : -1);
      }
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
  /* A lane is blocked by a run still FALLING in it — nothing else. Debris
     flying, dwelling, or skidding to rest does not conflict with a run
     entering from the top a whole gap later; only a column still coming
     down (or toppling as a slab) does. The old test (!st.lane[i], every
     airborne glyph) blocked ~45 of 52 lanes at any moment; even with this
     narrower count, falls outlast relocation cycles and most block-ends
     find nothing free — which is why the relocation RACE at the queueing
     site had to be made fair: scarce wins plus a birth-ordered contest was
     the right-heavy drift. st.lane keeps its job as the rest-accounting
     invariant; this is a separate count. */
  function laneFree(st, i) { return !st.busy[i] && !st.fallN[i]; }
  function unblockLane(st, g) {
    if (g.__blocksLane) {
      g.__blocksLane = false;
      if (st.fallN[g.__lane]) st.fallN[g.__lane]--;
    }
  }

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
      n: 0, clearing: false, columns: [], busy: {}, lane: {}, fallN: {}
    };
    for (var i = 0; i < Math.ceil(W / st.bw) + 1; i++) st.top.push(H);
    /* THE INK LEDGER — a second height field beside st.top, holding the
       highest deposited INK top per bucket. st.top is the packing ledger
       and keeps every job it had (resting, sliding, depositing, the dense
       nesting); this one exists only so the BREAK can begin where ink
       meets ink, per character, both sides of the collision. */
    st.inkTop = [];
    for (var ii = 0; ii < st.top.length; ii++) st.inkTop.push(H);
    /* the ink-rect cache and its scratch context, filled lazily by
       inkRect; emptied and remeasured when the webfont arrives */
    st.ink = {};
    st.inkCx = null;

    /* THE DRIFT IS ONE CANVAS. A deposited character is written once and
       never touched again — the sweep fades and clears the whole layer, and
       nothing ever reads a letter back — so it does not need to be an
       element. It must NOT be one: at ~5000 deposited <i>s the page's frame
       cadence degraded 17ms -> 67ms and every new throw sat parked on its
       first keyframe for the difference, a dead stop at the exact moment of
       contact (measured, 2026-08-24). The DOM now holds only what MOVES.
       Painted at the device pixel ratio so the type stays crisp; the element
       path below is the fallback for a sheet that cannot get a 2d context. */
    var pile = null, pctx = null, dpr = window.devicePixelRatio || 1;
    try {
      pile = document.createElement('canvas');
      pctx = pile.getContext('2d');
    } catch (e) { pctx = null; }
    if (pctx) {
      pile.width = Math.max(1, Math.round(W * dpr));
      pile.height = Math.max(1, Math.round(H * dpr));
      /* a canvas is a REPLACED element: the layer's inset-0 css does not
         stretch it, it sizes to its own bitmap — which is dpr times too big
         on any retina screen. The css size is stated outright. */
      pile.style.width = W + 'px';
      pile.style.height = H + 'px';
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      pile = document.createElement('span');
    }
    pile.className = 'rb-pile';
    host.appendChild(pile);
    st.layer = pile;
    st.ctx = pctx;
    st.dpr = dpr;
    /* per-script font strings and the baseline the CELL-high line box puts
       its text on, measured lazily and cached */
    st.met = {};
    st.fontStack = (css.getPropertyValue('--rb-mono') || '').trim() ||
      '"Courier Prime", "Courier New", Courier, monospace';
    /* Courier Prime arrives late in production, and canvas ink is write-once:
       letters painted before it lands would keep the fallback face for good
       (the old elements re-rendered themselves when the font came). So the
       first deposits are also kept as records, and one repaint follows the
       font in. The buffer exists only to cover those first seconds — a font
       that takes thousands of deposits to arrive forfeits the repaint. */
    st.pending = null;
    if (pctx && document.fonts && document.fonts.status !== 'loaded') {
      st.pending = [];
      document.fonts.ready.then(function () {
        if (host.__pile !== st || !st.pending) return;
        var q = st.pending;
        st.pending = null;
        if (st.clearing) return;
        st.met = {};
        /* the ink cache was measured against the fallback face: remeasure
           everything, and rebuild the ink ledger from the same buffered
           deposits the repaint replays. A buffer that overflowed already
           forfeits the repaint — the ledger then keeps its fallback-font
           tops (~1px stale), the same forfeit. */
        st.ink = {};
        for (var rb = 0; rb < st.inkTop.length; rb++) st.inkTop[rb] = st.H;
        pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pctx.clearRect(0, 0, st.W, st.H);
        for (var qi = 0; qi < q.length; qi++) {
          paintDeposit(st, q[qi]);
          recordInkTop(st, q[qi]);
        }
      });
    }

    /* which lanes hold a character dwelling at the surface, waiting to be
       crushed out by the next arrival */
    st.dwell = {};
    /* the dust pool, built once per mount. It lives inside the host, so
       Reset (mount clears innerHTML) takes the marks and the state that
       points at them down together. None under reduced motion. */
    st.fxLive = [];
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var fx = document.createElement('span');
      fx.className = 'rb-fx';
      host.appendChild(fx);
      st.fxPool = [];
      for (var fi = 0; fi < DUST_POOL; fi++) {
        var fd = document.createElement('i');
        fx.appendChild(fd);
        st.fxPool.push(fd);
      }
    }

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

  /* one glyph: fall to WHATEVER THE FLOOR IS WHEN IT GETS THERE, be thrown,
     bounce, come to rest — then lie there and go back to the top.

     THE FALL AND THE THROW ARE TWO ANIMATIONS NOW. The whole trajectory used
     to be baked at launch, but a glyph is in the air for seconds on this
     sheet and the drift RISES underneath it while it falls — so a column
     aimed at the launch-time surface plunged INTO the heap before
     scattering, and its debris came to rest below the surface and vanished.
     Instead the fall is aimed at the sheet's absolute bottom, and the
     reaper watches it against the LIVE height field: the moment it meets
     the drift's top — wherever that is by then — the fall is cancelled and
     the throw is computed there (owner directive, 2026-08-24: the pile is
     the new bottom, and the column breaks apart on IT). */
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
      /* NOT relocated here. Free lanes are chronically scarce (falls outlast
         relocation cycles, so most block-ends find none and the run stays
         put), which makes winning a free lane precious — and glyphs recycle
         in DOM order, which is column CREATION order, which is sorted left
         to right. Relocating inline handed every same-tick race to the
         leftmost-born column; the right-born ones lost, stayed, and rained
         extra blocks where they stood — the right-heavy drift the owner saw
         on every run (2026-08-24, measured: launches 54% right of centre
         while claims were uniform). Queued instead, and the reaper drains
         the queue in SHUFFLED order at the tick's end; the next launch into
         the new lane is a whole gap away, so the deferral costs nothing. */
      (st.reloQ = st.reloQ || []).push(col);
    }
    g.style.left = x0 + 'px';
    /* this character now occupies that lane until it comes to rest */
    g.__lane = Math.round(x0 / st.CELL);
    st.lane[g.__lane] = (st.lane[g.__lane] || 0) + 1;
    st.fallN[g.__lane] = (st.fallN[g.__lane] || 0) + 1;
    g.__blocksLane = true;

    /* the fall: straight down at a constant rate, aimed at the sheet's own
       bottom. Where it actually ENDS is the reaper's call — the interception
       against the live surface — so everything it needs to know the glyph's
       exact position from the animation clock alone is kept on the glyph. */
    g.__x0 = x0;
    g.__fallY0 = col.__y0;
    g.__fallDelay = wait;
    g.__fallSpeed = col.__speed;
    /* the striker's half of the ink collision, measured here at launch —
       one cache lookup a launch, nothing on the reaper's hot path */
    var inkR = inkRect(st, g.__rbKey, g.textContent);
    g.__inkBot = inkR ? inkR.bot : null;
    g.__phase = 'fall';
    var floorY = st.H - st.CELL;
    var fallMs = Math.max(1, (floorY - col.__y0) / col.__speed * 1000);

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
    g.__anim = g.animate(
      [{ transform: 'translate(0px,' + col.__y0 + 'px) rotate(0deg)', easing: 'linear' },
       { transform: 'translate(0px,' + floorY + 'px) rotate(0deg)' }],
      { duration: fallMs, delay: wait, fill: 'both' });
  }

  /* The moment of impact: the fall is cancelled where it stands and the
     throw is computed THERE, against the height field as it is now.
     Deliberately gentler than the impact sheet: there the point is debris
     leaving the frame, here it is debris coming to rest nearby, and a hard
     throw scatters everything to the walls instead of building a heap where
     the column actually fell.

     THE ENERGY IS NOT UNIFORM ANY MORE. A breaking thing sheds mostly weak
     pieces and the odd one that carries: squaring a uniform draw piles the
     mass at the low end, and the rare doubling is the outlier that makes the
     rest read as restrained rather than merely small. The dials multiply on
     top, so throw and loft still mean what they mean.

     kind says what sort of break this is:
       (none)  — the point of impact, full energy;
       'soft'  — a seated character crushed out of its dwell: its sideways
                 energy kept, barely any lift — all slide;
       'crush' — the newcomer that did the crushing: harder than a plain hit;
       'shock' — jostled loose ABOVE the break (scale = how little of the
                 blow reached it): sideways or slightly downward, never
                 lobbed, and it falls from wherever it was. */
  function throwNow(g, impactY, kind, scale, fromX, rot0) {
    var col = g.__col, st = col.__st, x0 = g.__x0;
    /* the fall (or the slab it became) is over: the lane is a lane again */
    unblockLane(st, g);
    /* fromX/rot0: a slab member breaks from where the topple LEFT it — leaned
       off its lane and already rotated — not from the lane's own x at zero.
       The physics starts there; the keyframe offsets stay relative to the
       element's left, which never moved. */
    var sx = fromX == null ? x0 : fromX;
    var r0 = rot0 || 0;
    /* what it hits matters, and so does which way it leaves: a mound sheds
       debris off its flanks, so on the heap the throw leans downhill — the
       drift's own shape acting on the physics instead of only receiving
       them. The bare rule has no flanks and stays even. A letter released
       out of a skid keeps the skid's direction — momentum does not re-roll —
       and a shock break happens in mid-air, above any slope. */
    var onBare = (st.H - st.CELL - impactY) < st.CELL;
    var dir;
    if (g.__dirHint) { dir = g.__dirHint; g.__dirHint = null; }
    else if (kind === 'shock' || onBare) dir = Math.random() < 0.5 ? -1 : 1;
    else dir = (Math.random() < 0.65 ? 1 : -1) * downhillDir(st, sx);
    var r = Math.random();
    var m = 0.4 + 0.9 * r * r;
    if (Math.random() < 0.07) m *= 2.2;
    /* the column's own momentum goes into what it throws, as on the impact
       sheet: a faster fall hits harder, and the speed dial gains a physical
       consequence. Clamped so no dialling makes the burst vanish or leave. */
    var punch = col.__speed / (st.zoom * PUNCH_REF);
    m *= punch < 0.6 ? 0.6 : punch > 1.6 ? 1.6 : punch;
    /* the bottom rule is hard and rings — a crisper bouncelet, a touch more
       lift — where the heap is dead weight that swallows the hop and gives
       the energy back as skid */
    var imp = {
      maxB: onBare ? 2 : 0,
      e: 0.2 + Math.random() * 0.15 + (onBare ? 0.1 : 0),
      vB: 150 * st.zoom,
      /* the floor of this draw is what stops the far tail: a fast fragment
         on the slickest ground is the one that crosses half the sheet */
      fric: (120 + Math.random() * 180) * st.zoom * (onBare ? 1.25 : 0.55)
    };
    /* kept for inspection only: nothing reads them back but the harness */
    g.__kind = kind || 'point';
    g.__impY = impactY;
    /* the pre-roll handed over by the reaper (see there): the crossing is
       preMs away and the break must not show — or puff — before it */
    var pre = g.__preMs || 0, preY = g.__preY;
    g.__preMs = 0;
    var vx, vy;
    if (kind === 'shock') {
      m *= scale;
      imp.maxB = 0;
      vx = dir * (70 + Math.random() * 260) * st.zoom * st.throwX * m;
      vy = (Math.random() * 90 - 15) * st.zoom * m;
    } else {
      /* a soft release keeps its sideways energy — being squeezed out under
         arriving weight goes low and FAR, not up — it only loses the lift */
      if (kind === 'soft')       { imp.maxB = 0; }
      else if (kind === 'crush') { m *= 1.15; }
      vx = dir * (95 + Math.random() * 430) * st.zoom * st.throwX * m;
      vy = -(115 + Math.random() * 255) * st.zoom * st.popY * m *
           (kind === 'soft' ? 0.35 : onBare ? 1.12 : 0.85);
      if (kind == null || kind === 'crush') puff(st, sx, impactY, 1 + rnd(3), pre);
    }
    var dt = 1 / 60;
    var pts = flyPath(st, sx, impactY, vx, vy, st.gravity * st.zoom, dt, PILE_STEPS, imp);
    var flightMs = Math.max(1, (pts.length - 1) * dt * 1000);
    /* ground torque: a piece travelling right rolls clockwise. The sign
       follows the sideways velocity most of the time; the exceptions are
       clipped corners. A letter skidding one way while spinning the other
       reads wrong, and it was a coin toss before. */
    var spin = (Math.random() < 0.8 ? (vx >= 0 ? 1 : -1) : (vx >= 0 ? -1 : 1)) *
               (80 + Math.random() * 420) * st.spinMul;

    /* THE PRE-ROLL. When the reaper saw the crossing COMING rather than
       gone by, the last few px of fall are baked into this same animation:
       the glyph keeps falling to the exact floor and the break begins
       THERE, in the same frame stream — no seam, no snap, no early or late
       registration. */
    var total = pre + flightMs;
    var frames = [];
    if (pre > 0) {
      frames.push({
        offset: 0, easing: 'linear',
        transform: 'translate(0px,' + preY.toFixed(1) + 'px) rotate(' + r0.toFixed(1) + 'deg)'
      });
    }
    for (var i = 0; i < pts.length; i++) {
      var f = pts.length > 1 ? i / (pts.length - 1) : 1;
      frames.push({
        offset: (pre + f * flightMs) / total,
        transform: 'translate(' + (pts[i].x - x0).toFixed(1) + 'px,' +
                   pts[i].y.toFixed(1) + 'px) rotate(' + (r0 + spin * f).toFixed(0) + 'deg)',
        easing: 'linear'
      });
    }
    /* explicit offsets mean the edges must be pinned: a first keyframe past
       0 or a last short of 1 makes the browser synthesize one from the base
       css, which parks the glyph at the top of the sheet in plain view */
    if (frames.length < 2) frames.push({ offset: 1, transform: frames[0].transform, easing: 'linear' });
    frames[0].offset = 0;
    var rest = pts[pts.length - 1];
    g.__rest = { x: rest.x, y: rest.y, rot: r0 + spin };
    g.__phase = 'fly';
    if (g.__anim) g.__anim.cancel();
    g.__anim = g.animate(frames, { duration: total, fill: 'both' });
  }

  /* Not every arrival breaks at once. About half LODGE where they strike and
     sit a fraction of a beat before the break, so the rhythm of a column
     being taken apart is tick...tick-TACK, not a metronome. But a lodge is
     not a freeze: the fragment that does not shatter keeps its momentum and
     PLOUGHS to rest — a decelerating skid of a fraction of a square, biased
     downhill, easing over into a lean. The old 2px wedge was sub-perceptual,
     and a letter holding still just above the surface read as a dead stop
     (owner, 2026-08-24). The TIMING machinery is unchanged: the deadline
     lives on the glyph and is judged in the reaper's own time, so pausing
     stops it and a dwell can outlive a pause but never leak past one. A
     dwelling character is still in its lane — the lane count is untouched
     until it finally comes to rest. */
  function settle(g, impactY, now) {
    var col = g.__col, st = col.__st;
    unblockLane(st, g);
    /* the pre-roll, exactly as in throwNow: the tail of the fall rides at
       the front of this animation, and the lodge deadline counts from the
       moment of CONTACT, not of scheduling */
    var pre = g.__preMs || 0, preY = g.__preY;
    g.__preMs = 0;
    g.__phase = 'dwell';
    g.__dwellT = now + pre + 40 + Math.random() * 120;
    g.__impY = impactY;
    st.dwell[g.__lane] = g;
    /* the skid obeys the same slope the slide does: on a steep flank the
       plough leans harder downhill, and a draw that still goes against the
       grade dies in half the distance — a letter lodging on a flank must
       not contradict the physics running beside it */
    var gr = slopeAt(st, g.__x0);
    var dir = Math.random() < (Math.abs(gr) > 0.25 ? 0.85 : 0.7)
      ? downhillDir(st, g.__x0) : (rnd(2) ? 1 : -1);
    var dx = dir * (0.25 + Math.random() * 0.55) * st.CELL;
    if (Math.abs(gr) > 0.25 && dir * gr < 0) dx *= 0.5;
    var s = g.__skid = {
      y: impactY,
      dx: dx,
      dy: 2 + Math.random(),
      rot: dir * (6 + Math.random() * 8),
      dur: 140 + Math.random() * 70,
      pre: pre,
      dir: dir
    };
    /* sampled with the same quadratic ease-out releaseDwell evaluates: fast
       off the mark, dying to nothing — the deceleration is the message. The
       cubic before it spent half the travel in the first fifth of the skid,
       and at a degraded frame rate the tail read as an early stop. */
    var total = pre + s.dur;
    var fr = [], K = 5;
    if (pre > 0) {
      fr.push({ offset: 0, easing: 'linear',
                transform: 'translate(0px,' + preY.toFixed(1) + 'px) rotate(0deg)' });
    }
    for (var k = 0; k <= K; k++) {
      var u = 1 - k / K, e = 1 - u * u;
      fr.push({
        offset: (pre + (k / K) * s.dur) / total,
        transform: 'translate(' + (s.dx * e).toFixed(1) + 'px,' +
                   (impactY + s.dy * e).toFixed(1) + 'px) rotate(' +
                   (s.rot * e).toFixed(1) + 'deg)',
        easing: 'linear'
      });
    }
    fr[0].offset = 0;
    if (g.__anim) g.__anim.cancel();
    g.__anim = g.animate(fr, { duration: total, fill: 'both' });
  }

  /* The break at the end of a lodge starts from wherever the skid has
     carried the letter — evaluated off the animation clock with the ease the
     keyframes were sampled at, no layout read — and it keeps the skid's
     direction: being crushed out, or simply letting go, does not turn a
     ploughing thing around. */
  function releaseDwell(g, kind) {
    var s = g.__skid, e = 1;
    if (g.__anim && g.__anim.currentTime != null)
      e = Math.max(0, Math.min(1, (g.__anim.currentTime - s.pre) / s.dur));
    /* the same quadratic the skid keyframes were sampled at — the two MUST
       share the shape, or the throw starts from a position the render
       never showed */
    var u = 1 - e, k = 1 - u * u;
    g.__dirHint = s.dir;
    throwNow(g, s.y + s.dy * k, kind, undefined, g.__x0 + s.dx * k, s.rot * k);
  }

  /* The break runs UP the column: a hit below has a fair chance of knocking
     one or two of the characters still falling in the same lane loose EARLY,
     from their own height, with what little of the blow reached them — so an
     impact reads as a clustered burst with the mass above jostled, never as
     the whole column letting go at once (tried, and rejected, by the owner).
     Their y comes off the animation clock, no layout read; the scan is this
     column's own children, only on impact; and the cooldown keeps a run
     jostled and thinned rather than deleted. */
  function shockwave(g0, impactY, now) {
    var col = g0.__col, st = col.__st;
    if (now < (col.__shockT || 0) || Math.random() > 0.55) return;
    col.__shockT = now + col.__beat * 2;
    var kids = col.children, want = Math.random() < 0.4 ? 2 : 1, hits = 0;
    var topY = null;
    for (var i = 0; i < kids.length && hits < want; i++) {
      var s = kids[i];
      if (s === g0 || s.__phase !== 'fall' || s.__x0 !== g0.__x0 || !s.__anim) continue;
      var ct = s.__anim.currentTime;
      if (ct == null || ct <= s.__fallDelay) continue;
      var y = s.__fallY0 + (ct - s.__fallDelay) / 1000 * s.__fallSpeed;
      var dy = impactY - y;
      if (dy < st.CELL * 1.5 || dy > st.CELL * 7) continue;
      throwNow(s, y, 'shock', 1 - dy / (st.CELL * 9));
      if (topY == null || y < topY) topY = y;
      hits++;
    }
    /* a character shaken out from under the run above it takes the run's
       footing with it, most of the time */
    if (hits && Math.random() < 0.65) collapseAbove(col, g0.__x0, topY, now);
  }

  /* THE COLLAPSE. When the shock shakes a character loose, the run above it
     has lost what it stood on: those characters stop falling as rain and go
     down TOGETHER — a slab, still spaced as the column it was, tipping a few
     degrees to one side as it drops — and it breaks apart only when its BASE
     strikes the surface (owner directive, 2026-08-24). Between the
     one-at-a-time metronome and the all-at-once explosion, both already
     rejected, this is the middle thing: the column falls as a unit and
     shatters as a unit.

     The rigidity costs nothing: the members share the column's fall speed,
     so giving each the same drop keeps their spacing exact, and the lean is
     a per-member offset that grows with height above the base — a rotation
     about the base, small-angle, sampled into the same keyframes. Every
     member's animation runs the same duration, so the reaper finds them all
     finished on one tick and the shatter is simultaneous along the slab's
     length: the base hits hardest, the pieces above burst from mid-air with
     what reaches them. */
  function collapseAbove(col, x0, topY, now) {
    var st = col.__st;
    var members = [], kids = col.children, i;
    for (i = 0; i < kids.length; i++) {
      var s = kids[i];
      if (s.__phase !== 'fall' || s.__x0 !== x0 || !s.__anim) continue;
      var ct = s.__anim.currentTime;
      if (ct == null || ct <= s.__fallDelay) continue;
      var y = s.__fallY0 + (ct - s.__fallDelay) / 1000 * s.__fallSpeed;
      if (y >= topY || y < topY - st.CELL * 9) continue;
      members.push({ g: s, y: y });
    }
    if (members.length < 2) return;
    /* base first; keep the six nearest the break — anything higher is
       another run's business */
    members.sort(function (a, b) { return b.y - a.y; });
    if (members.length > 6) members.length = 6;
    /* a collapse is a bigger event than a jostle: the column earns a longer
       quiet spell before the next one */
    col.__shockT = now + col.__beat * 6;

    var yBase = members[0].y;
    /* the slab strikes where its BASE character's ink does */
    var floorY = strikeFloorFor(st, members[0].g);
    var d = floorY - yBase;
    if (d < st.CELL * 0.5) {
      /* the surface is already at the base: no room to topple — it just goes */
      for (i = 0; i < members.length; i++)
        throwNow(members[i].g, members[i].y, 'shock', 0.7);
      return;
    }
    var v0 = col.__speed, grav = st.gravity * st.zoom;
    var T = (Math.sqrt(v0 * v0 + 2 * grav * d) - v0) / grav;
    var dir = Math.random() < 0.5 ? -1 : 1;
    var theta = (8 + Math.random() * 14) * Math.PI / 180;
    var K = 12;
    for (i = 0; i < members.length; i++) {
      var m = members[i], g = m.g, h = yBase - m.y;
      var frames = [];
      for (var k = 0; k <= K; k++) {
        var t = T * k / K;
        /* the tip accelerates: an upright thing losing its footing leans
           slowly at first and is moving fastest when it lands */
        var th = theta * (k / K) * (k / K);
        frames.push({
          transform: 'translate(' + (Math.sin(th) * h * dir).toFixed(1) + 'px,' +
                     (m.y + v0 * t + 0.5 * grav * t * t).toFixed(1) + 'px)' +
                     ' rotate(' + (th * 180 / Math.PI * dir).toFixed(1) + 'deg)',
          easing: 'linear'
        });
      }
      g.__phase = 'slab';
      g.__slabX = x0 + Math.sin(theta) * h * dir;
      g.__slabY = m.y + v0 * T + 0.5 * grav * T * T;
      g.__slabRot = theta * 180 / Math.PI * dir;
      g.__slabH = h;
      if (g.__anim) g.__anim.cancel();
      g.__anim = g.animate(frames, { duration: Math.max(1, T * 1000), fill: 'both' });
    }
  }

  /* Dust at the point of impact: a few tiny marks flicked outward and gone
     inside a third of a second. The marks are a FIXED POOL, dealt out and
     taken back — when the pool is out, dust is simply skipped, never grown —
     because a landing can ask for three at once and the sheet takes dozens
     of landings a second. Dust deposits nothing and touches no height
     field; under reduced motion the pool is never built and this is a no-op. */
  function puff(st, x, y, n, delay) {
    if (!st.fxPool) return;
    while (n-- > 0 && st.fxPool.length) {
      var d = st.fxPool.pop();
      var dir = Math.random() < 0.5 ? -1 : 1;
      var x1 = x + st.CELL * (0.2 + Math.random() * 0.6);
      var y1 = y + st.CELL * (0.6 + Math.random() * 0.3);
      if (d.__anim) d.__anim.cancel();
      d.textContent = DUST[rnd(DUST.length)];
      /* fill none, NOT both: a delayed flick (dust waits out the striker's
         pre-roll) must stay hidden under its base css until the moment of
         contact, and both would paint the first keyframe through the wait */
      d.__anim = d.animate(
        [{ transform: 'translate(' + x1.toFixed(1) + 'px,' + y1.toFixed(1) + 'px)',
           opacity: 0.55, easing: 'ease-out' },
         { transform: 'translate(' + (x1 + dir * (0.3 + Math.random() * 0.8) * st.CELL).toFixed(1) + 'px,' +
                      (y1 + (Math.random() * 0.5 - 0.1) * st.CELL).toFixed(1) + 'px)',
           opacity: 0 }],
        { duration: 120 + Math.random() * 160, delay: delay || 0, fill: 'none' });
      st.fxLive.push(d);
    }
  }

  /* One timer per sheet, doing two jobs a poll: intercepting every FALLING
     glyph against the surface as it is right now — the fall is linear at a
     known speed, so its y comes off the animation's own clock with no layout
     read — and collecting every FLOWN glyph that has come to rest. The
     interception is what makes a column break apart on the drift's top
     instead of at the paper's bottom rule: the floor it strikes is looked
     up at the moment of arrival, not at launch. */
  function startReaper(host, st) {
    if (host.__reaper) clearInterval(host.__reaper);
    host.__reaper = setInterval(function () {
      var now = performance.now();
      var gl = host.querySelectorAll('.rb-drop > i');
      for (var i = 0; i < gl.length; i++) {
        var g = gl[i], a = g.__anim;
        if (!a) continue;
        if (g.__phase === 'fall') {
          var ct = a.currentTime;
          if (ct == null) continue;
          var y = g.__fallY0 + Math.max(0, ct - g.__fallDelay) / 1000 * g.__fallSpeed;
          var floorY = strikeFloorFor(st, g);
          /* BREAK WHERE THE EYE SEES THE TOUCH. A poll every 60ms can only
             ever notice a crossing after the fact, and rendering the break
             from the snapped floor played as an upward rewind at the very
             moment of contact (measured: 8-16px at the median). But the
             fall is linear at a known speed, so the crossing can be seen
             COMING: within a tick of the floor, the break is computed now
             and the remaining fall rides at the front of its animation (the
             pre-roll in throwNow/settle) — the glyph touches the exact ink
             floor and reacts in the same frame stream, no seam either way.
             A crossing already gone by (a late tick, or a drift that rose
             OVER a slow faller mid-air) breaks from the detected y, capped
             a few px past the floor. Rest and deposit keep the ledger;
             only where the break begins moves. */
          var early = y < floorY - 0.5;
          if (y + g.__fallSpeed * 0.075 >= floorY || a.playState === 'finished') {
            var held = st.dwell[g.__lane];
            if (held && held.__phase === 'dwell') {
              /* the crush: this one lands on a character still skidding
                 where it struck. It waits for the touch itself — the crush
                 must be SEEN to be caused — then both go in one tick: the
                 lodged one driven out low along its own skid, the newcomer
                 breaking harder. A clustered two-fragment burst. */
              if (!early) {
                var impactY = Math.min(y, floorY + st.CELL * LATE_CAP);
                st.dwell[g.__lane] = null;
                releaseDwell(held, 'soft');
                throwNow(g, impactY, 'crush');
                shockwave(g, impactY, now);
              }
            } else {
              if (early) {
                g.__preMs = (floorY - y) / g.__fallSpeed * 1000;
                g.__preY = y;
              }
              var impY = early ? floorY : Math.min(y, floorY + st.CELL * LATE_CAP);
              if (Math.random() < 0.5) {
                settle(g, impY, now);
              } else {
                throwNow(g, impY);
                shockwave(g, impY, now);
              }
            }
          }
        } else if (g.__phase === 'dwell') {
          /* this branch must come before the landed check: the skid
             animation FINISHES on its own in ~120-180ms and a finished
             lodge is not a landing — its __rest is a cycle stale */
          if (now >= g.__dwellT) {
            if (st.dwell[g.__lane] === g) st.dwell[g.__lane] = null;
            releaseDwell(g, 'soft');
          }
        } else if (g.__phase === 'slab') {
          /* likewise before the landed check — a finished slab has struck,
             not rested. Every member of a slab runs the same duration, so
             the whole thing shatters on one tick: the base like a crush,
             the pieces above bursting from mid-air with what reaches them,
             each from where the topple left it, at the angle it leant to.
             No shockwave off a slab's own break — a collapse does not beget
             a collapse. */
          if (a.playState === 'finished') {
            var base = g.__slabH === 0;
            throwNow(g, g.__slabY, base ? 'crush' : 'shock',
                     base ? undefined : Math.max(0.35, 0.9 - g.__slabH / (st.CELL * 12)),
                     g.__slabX, g.__slabRot);
          }
        } else if (a.playState === 'finished') {
          onPileLanded(g);
        }
      }
      /* take spent dust back into the pool. Cancelled, not left finished:
         resuming from a pause plays every animation it finds, and a finished
         fade would replay — an idle one stays hidden under its base css. */
      for (var j = st.fxLive.length - 1; j >= 0; j--) {
        if (st.fxLive[j].__anim.playState === 'finished') {
          st.fxLive[j].__anim.cancel();
          st.fxPool.push(st.fxLive[j]);
          st.fxLive.splice(j, 1);
        }
      }
      /* the tick's relocations, drained in SHUFFLED order: free lanes are
         scarce and whoever asks first gets them, so the asking order must
         not be the columns' birth order (see the queueing site) */
      if (st.reloQ && st.reloQ.length) {
        var q = st.reloQ;
        st.reloQ = [];
        for (var ri = q.length - 1; ri > 0; ri--) {
          var rj = rnd(ri + 1), rt = q[ri]; q[ri] = q[rj]; q[rj] = rt;
        }
        for (ri = 0; ri < q.length; ri++) relocate(q[ri]);
      }
    }, 60);
  }

  /* One script's font string and baseline, measured once and cached. The
     size is the script's own (the same table the CSS sizes are generated
     from, times the zoom); the baseline is where a CELL-high line box puts
     its text — half the leading, then the ascent — measured off a Latin
     strut character so the PRIMARY font's metrics rule, exactly as CSS
     inline layout does for every script in the stack. */
  function glyphFont(st, key) {
    var m = st.met[key];
    if (!m) {
      var fs = (POOL[key] ? POOL[key].s : 10) * st.zoom;
      st.ctx.font = fs.toFixed(2) + 'px ' + st.fontStack;
      var tm = st.ctx.measureText('H');
      var a = tm.fontBoundingBoxAscent, d = tm.fontBoundingBoxDescent;
      if (a == null) { a = fs * 0.8; d = fs * 0.2; }
      m = st.met[key] = { font: st.ctx.font,
                          base: (st.CELL - (a + d)) / 2 + a };
    }
    return m;
  }

  /* One character's ink bounds inside its unrotated cell box: rasterized
     once on a scratch canvas at double scale — the exact font string and
     baseline the deposit paint uses — and the alpha scanned for the
     bounding rect (the technique pixel-validated to ±1px). Cached per
     script|character pair, so the pool's own character set bounds the
     cache; null for a character that leaves no mark. Clamped to the cell,
     as the rendering clips. A sheet with no 2d context measures nothing
     and the ledger machinery stands down to the constant-slack floor. */
  function inkRect(st, key, ch) {
    var id = key + '|' + ch;
    var r = st.ink[id];
    if (r !== undefined) return r;
    if (!st.ctx) return (st.ink[id] = null);
    var S = 2, px = Math.ceil(st.CELL * S);
    if (!st.inkCx) {
      var cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      st.inkCx = cv.getContext('2d', { willReadFrequently: true });
      if (!st.inkCx) return (st.ink[id] = null);
    }
    var m = glyphFont(st, key), c = st.inkCx;
    c.setTransform(S, 0, 0, S, 0, 0);
    c.clearRect(0, 0, st.CELL, st.CELL);
    c.font = m.font;
    c.textAlign = 'center';
    c.fillText(ch, st.CELL / 2, m.base);
    var d = c.getImageData(0, 0, px, px).data;
    var x0 = px, x1 = -1, y0 = px, y1 = -1;
    for (var y = 0; y < px; y++) {
      for (var x = 0; x < px; x++) {
        if (d[(y * px + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    r = x1 < 0 ? null
      : { x0: Math.max(0, x0 / S), x1: Math.min(st.CELL, (x1 + 1) / S),
          top: Math.max(0, y0 / S), bot: Math.min(st.CELL, (y1 + 1) / S) };
    return (st.ink[id] = r);
  }

  /* A deposit's contribution to the ink ledger: its ink rect carried
     through the same rotation the paint applied, the rotated corners' top
     written with min() into the buckets under their x-extent. Blank ink
     records nothing. The packing ledger is not touched here — st.top
     alone decides how the heap nests. */
  function recordInkTop(st, dep) {
    var r = inkRect(st, dep.k, dep.ch);
    if (!r) return;
    var h = st.CELL / 2, a = dep.rot * Math.PI / 180;
    var ca = Math.cos(a), sa = Math.sin(a);
    var xs = [r.x0 - h, r.x1 - h, r.x0 - h, r.x1 - h];
    var ys = [r.top - h, r.top - h, r.bot - h, r.bot - h];
    var minX = 1e9, maxX = -1e9, minY = 1e9;
    for (var i = 0; i < 4; i++) {
      var x = xs[i] * ca - ys[i] * sa, y = xs[i] * sa + ys[i] * ca;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
    }
    var top = dep.y + h + minY;
    var b0 = Math.max(0, Math.floor((dep.x + h + minX) / st.bw));
    var b1 = Math.min(st.inkTop.length - 1,
                      Math.max(b0, Math.ceil((dep.x + h + maxX) / st.bw) - 1));
    for (var b = b0; b <= b1; b++) if (top < st.inkTop[b]) st.inkTop[b] = top;
  }

  /* Paint one deposited character the way its element rendered: rotated
     about its own box center, clipped to the CELL square (the element had
     overflow:hidden), the drift's ink at the drift's opacity. No mirroring —
     an is-rev glyph's inline rotate replaced the class's scaleX on the old
     elements too, so deposits have never rendered mirrored. */
  function paintDeposit(st, dep) {
    var ctx = st.ctx, m = glyphFont(st, dep.k), h = st.CELL / 2;
    ctx.save();
    ctx.translate(dep.x + h, dep.y + h);
    ctx.rotate(dep.rot * Math.PI / 180);
    ctx.beginPath();
    ctx.rect(-h, -h, st.CELL, st.CELL);
    ctx.clip();
    ctx.font = m.font;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a628a';
    ctx.globalAlpha = 0.9;
    ctx.fillText(dep.ch, 0, m.base - h);
    ctx.restore();
  }

  function onPileLanded(g) {
    var col = g.__col, st = col.__st, r = g.__rest;
    /* out of its lane. Decremented here and incremented in runGlyph, exactly
       once each per launch, so the count cannot drift. */
    if (g.__lane != null && st.lane[g.__lane]) st.lane[g.__lane]--;
    /* THE SURFACE MAY HAVE RISEN WHILE THIS GLYPH WAS IN THE AIR. Its rest
       was computed at launch against the height field of that moment, and a
       long fall on a tall sheet leaves seconds for other landings to build
       underneath it. Depositing at the stale y buries the letter inside the
       drift and records nothing — the surface there is already above it —
       so the heap converges to a shallow dense mat instead of stacking
       (measured: 877 landings, every bucket stuck under one square deep).
       Re-seat the letter on the surface as it is NOW; min() keeps the
       computed rest when it is already the higher of the two. */
    var restY = Math.min(r.y, surfaceMeanAt(st, r.x, st.CELL) - st.CELL);
    st.calls = (st.calls || 0) + 1;
    if (st.clearing) st.skipClearing = (st.skipClearing || 0) + 1;
    else if (st.n >= st.cap) st.skipCap = (st.skipCap || 0) + 1;
    else if (!(restY > st.floorLimit)) st.skipFloor = (st.skipFloor || 0) + 1;
    if (!st.clearing && st.n < st.cap && restY > st.floorLimit) {
      /* lying at whatever angle it stopped at, plus a little */
      var rot = r.rot % 360 + (rnd(21) - 10);
      var dep = { k: g.__rbKey, ch: g.textContent, x: r.x, y: restY, rot: rot };
      if (st.ctx) {
        paintDeposit(st, dep);
        if (st.pending) {
          st.pending.push(dep);
          if (st.pending.length > 1500) st.pending = null;
        }
      } else {
        var d = document.createElement('i');
        d.className = g.className;
        d.textContent = g.textContent;
        d.style.left = r.x.toFixed(1) + 'px';
        d.style.top = restY.toFixed(1) + 'px';
        d.style.transform = 'rotate(' + rot.toFixed(0) + 'deg)';
        st.layer.appendChild(d);
      }
      recordInkTop(st, dep);
      depositAt(st, r.x, st.CELL, restY);
      st.n++;
      /* Sweep on the AVERAGE depth, not the highest point. surfaceAt returns
         the minimum top across its span, so the old test cleared the floor as
         soon as a single spike reached the limit — with most of the sheet
         still bare. The drift should be broadly full before it goes.

         A cap of Infinity means NO sweeping at all — the dial's 'never'.
         The drift then simply HOLDS when it is full: a letter that comes to
         rest above the floor limit is not deposited (the r.y guard above),
         so the rain keeps falling but nothing more sticks. The piece stopped
         clearing itself because the owner watched it do exactly that and
         called it "resetting" (2026-08-24). */
      if (st.n >= st.cap ||
          (st.cap !== Infinity && meanTop(st) <= st.floorLimit)) sweepPile(st);
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
      /* the same 2s opacity fade as ever — a canvas element fades like any
         other — then the ink itself is wiped */
      if (st.ctx) st.ctx.clearRect(0, 0, st.W, st.H);
      else st.layer.innerHTML = '';
      if (st.pending) st.pending.length = 0;
      st.layer.classList.remove('is-going');
      /* both ledgers go together, or a post-sweep strike would break on
         the ghost ink of letters no longer there */
      for (var i = 0; i < st.top.length; i++) st.top[i] = st.H;
      for (var i2 = 0; i2 < st.inkTop.length; i2++) st.inkTop[i2] = st.H;
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
    var gl = host.querySelectorAll('.rb-drop > i, .rb-fx > i'), i;
    for (i = 0; i < gl.length; i++) {
      var a = gl[i].__anim;
      if (!a) continue;
      /* pooled dust holds a CANCELLED animation; play() would run it from
         nothing, at a stale position, so idle ones are left idle */
      try { want ? a.pause() : (a.playState !== 'idle' && a.play()); } catch (e) {}
    }
    /* the reaper must stop too, or a paused sheet keeps harvesting whatever
       was already finished and the drift grows while it is meant to be still */
    if (want) {
      host.__pausedAt = performance.now();
      if (host.__reaper) { clearInterval(host.__reaper); host.__reaper = null; }
    } else if (host.__pile && !host.__reaper) {
      /* dwell deadlines are wall-clock: without this shift every seated
         character's deadline expires during the pause and the first reaper
         tick after a resume releases them all at once — a synchronized pop
         across the whole sheet */
      if (host.__pausedAt) {
        var shift = performance.now() - host.__pausedAt;
        for (i = 0; i < gl.length; i++) {
          if (gl[i].__phase === 'dwell') gl[i].__dwellT += shift;
        }
        host.__pausedAt = null;
      }
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
