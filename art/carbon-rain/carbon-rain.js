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

   This is a SIBLING of the wait indicator in art/junk-drawer/junk-drawer.js,
   not a shared library — the two are meant to grow apart. If you change the
   character pool here, that one does not follow.
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
    el.className = 'cr-g cr-' + key + (rev ? ' is-rev' : '') +
                   (el.getAttribute('data-spin') || '');
    el.textContent = ch;
    el.removeAttribute('data-word');
  }

  function fill(s) {
    var cells = s.children, n = cells.length, i;
    for (i = 0; i < n; i++) strike(cells[i]);
    if (Math.random() < s.__wordP) {
      var pool = [], w;
      for (i = 0; i < s.__words.length; i++) {
        if (s.__words[i].length + 2 <= n) pool.push(s.__words[i]);
      }
      if (pool.length) {
        w = pool[rnd(pool.length)];
        var at = rnd(n - w.length + 1);
        for (i = 0; i < w.length; i++) {
          var c = cells[at + i];
          /* upright Latin, never reversed, never re-struck: the word surfaces
             out of the noise because it is coherent, not because it is a
             different colour */
          c.className = 'cr-g cr-lat is-word';
          c.textContent = w.charAt(i) === ' ' ? '' : w.charAt(i);
          c.setAttribute('data-word', '1');
        }
      }
    }
  }

  function onWrap(e) {
    /* animationiteration BUBBLES. Every pinwheel square inside this stream
       runs its own crSpin, and those events arrive here too — without this
       guard a column re-rolls whenever one of its pinwheels completes a turn,
       mid-fall and in plain sight. */
    if (e.target !== this || e.animationName !== 'crFall') return;
    fill(this);
  }

  var timers = [];
  function build(host, opt) {
    opt = opt || {};
    var W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return 0;
    /* CSS owns the zoom: --cr-cell is the square every glyph sits in, and the
       same value rules the paper. Reading it here means the two cannot drift. */
    var css = getComputedStyle(host);
    var CELL = parseFloat(css.getPropertyValue('--cr-cell')) || 9;
    var zoom = CELL / 9;
    /* --cr-h is the SHEET's height. A percentage in translateY resolves
       against the ELEMENT's own height, so 100% here would move a stream by
       its own length and wrap it in full view, mid-sheet. */
    host.style.setProperty('--cr-h', H + 'px');
    var words = opt.words || ['LOADING', 'STAND BY'];
    var wordP = opt.wordP == null ? 0.06 : opt.wordP;
    var spinP = opt.spinP == null ? 0.06 : opt.spinP;
    var rows = Math.floor(H / CELL);
    var frag = document.createDocumentFragment(), streams = [];
    for (var c = 0; c < Math.floor(W / CELL); c++) {
      /* every column carries a stream; the gaps in the rain are made by a
         run-up above the sheet, so a column empties and fills again on its own
         cycle rather than being dealt empty and staying blank */
      var col = document.createElement('span');
      col.className = 'cr-c';
      col.style.left = (c * CELL) + 'px';
      col.style.setProperty('--cr-o', (0.62 + Math.random() * 0.38).toFixed(2));
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
        st.className = 'cr-s';
        st.style.setProperty('--cr-dh', lead + 'px');
        st.style.setProperty('--cr-d', d.toFixed(2) + 's');
        var ph = (base + s * d / 2) % d;
        st.style.setProperty('--cr-dl', (-ph).toFixed(2) + 's');
        st.style.setProperty('--cr-y0', Math.round(-lead + travel * ph / d) + 'px');
        for (i = 0; i < len; i++) {
          var cell = document.createElement('i');
          if (Math.random() < spinP) {
            cell.setAttribute('data-spin',
              ' is-spin' + (Math.random() < 0.5 ? ' is-ccw' : ''));
            cell.style.setProperty('--cr-sd', (4 + Math.random() * 7).toFixed(2) + 's');
          }
          st.appendChild(cell);
        }
        st.__words = words; st.__wordP = wordP;
        fill(st);
        st.addEventListener('animationiteration', onWrap);
        col.appendChild(st);
        streams.push(st);
      }
      frag.appendChild(col);
    }
    host.appendChild(frag);
    /* the slow in-view re-strike: a few squares a second, caught out of the
       corner of an eye rather than watched */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var rate = opt.visibleRate == null ? 10 : opt.visibleRate;
      timers.push(setInterval(function () {
        for (var i = 0; i < rate; i++) {
          var st = streams[rnd(streams.length)];
          if (!st) continue;
          var cell = st.children[rnd(st.children.length)];
          if (cell && !cell.getAttribute('data-word')) strike(cell);
        }
      }, 1000));
    }
    return streams.length;
  }

  window.CarbonRain = {
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
      for (var i = 0; i < timers.length; i++) clearInterval(timers[i]);
      timers = [];
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
