#!/usr/bin/env python3
"""Append weather, colors, news, death, and filler-phrase vocab. Run from data/: python add_expansion_vocab.py"""
import json
from pathlib import Path

# (id, type, english, msa_form, msa_translit, root, msa_example, lev_form, lev_translit, lev_notes, lev_example, tags, dlpt, rank)
NEW = [
    # ── Weather nouns ──
    ("n137", "noun", "rain", "مَطَر", "matar", "م ط ر", "هطل المطر بغزارة.", "مطر", "matar", "Same.", "نزل مطر غزير.", ["weather"], "1", 137),
    ("n138", "noun", "snow", "ثَلْج", "thalj", "ث ل ج", "غطى الثلج الجبال.", "تلفان / ثلج", "talfaan / thalj", "تلفان common in Lev.", "التلفان غطى الجبال.", ["weather"], "1", 138),
    ("n139", "noun", "sun", "شَمْس", "shams", "ش م س", "أشرقت الشمس هذا الصباح.", "شمس", "shams", "Same.", "الشمس طلعت الصبح.", ["weather"], "0+", 139),
    ("n140", "noun", "cloud", "سَحَابَة / غَيْم", "sahaaba / ghaym", "س ح ب", "ملأت الغيوم السماء.", "غيم", "ghaym", "Same.", "الغيم ملّى السما.", ["weather"], "1", 140),
    ("n141", "noun", "wind", "رِيح", "reeh", "ر و ح", "هبت رياح قوية ليلاً.", "ريح", "reeh", "Same.", "الريح كانت قوية.", ["weather"], "1", 141),
    ("n142", "noun", "storm", "عَاصِفَة", "aasifa", "ع ص ف", "تسببت العاصفة بانقطاع الكهرباء.", "عاصفة", "aasife", "Same.", "العاصفة قطعت الكهربا.", ["weather"], "2", 142),
    ("n143", "noun", "thunder", "رَعْد", "ra'd", "ر ع د", "سمعنا الرعد من بعيد.", "رعد", "ra'd", "Same.", "سمعنا رعد.", ["weather"], "1+", 143),
    ("n144", "noun", "lightning", "بَرْق", "barq", "ب ر ق", "أضاء البرق السماء.", "برق", "bar'","Same.", "البرق لمع بالسما.", ["weather"], "1+", 144),
    ("n145", "noun", "fog", "ضَبَاب", "dabaab", "ض ب ب", "خفّ الضباب عند الظهر.", "ضباب", "dabaab", "Same.", "الضباب خفّ الظهر.", ["weather"], "2", 145),
    ("n146", "noun", "humidity", "رُطُوبَة", "rutuba", "ر ط ب", "ارتفعت الرطوبة في المدينة.", "رطوبة", "rutube", "Same.", "الرطوبة عالية.", ["weather"], "2", 146),
    ("n147", "noun", "temperature", "دَرَجَة الحُرُورَة", "darajat alhuruura", "ح ر ر", "ارتفعت درجة الحرارة.", "حرارة", "harara", "Short form.", "الحرارة طالعة.", ["weather"], "1", 147),
    ("n148", "noun", "heatwave", "مَوْجَة حَرّ", "mawjat harr", "ح ر ر", "تسببت موجة الحر بإغلاق المدارس.", "موجة حر", "mawjat har", "Same.", "موجة الحر سكرت المدارس.", ["weather"], "2+", 148),
    ("n149", "noun", "drought", "جَفَاف", "jafaaf", "ج ف ف", "أدى الجفاف إلى نقص المياه.", "جفاف", "jafaaf", "Same.", "الجفاف نقص المي.", ["weather", "news"], "2+", 149),
    ("n150", "noun", "flood", "فَيَضَان", "fayaDaan", "ف ي ض", "أغرق الفيضان الأحياء السكنية.", "فيضان", "fayDaan", "Same.", "الفيضان غمر البيوت.", ["weather", "news"], "2", 150),
    ("n151", "noun", "forecast (weather)", "تَوَقُّعَات الطَّقْس", "tawaqqu'aat attaqas", "و ق ع", "تشير توقعات الطقس إلى أمطار غداً.", "توقعات الطقس", "tawaqqu'at ett'as", "Same.", "التوقعات بتقول مطر بكرا.", ["weather", "news"], "2", 151),

    # ── Weather verbs ──
    ("v133", "verb", "to rain", "هَطَلَ / يَهْطِلُ", "hatala / yahtilu", "ه ط ل", "من المتوقع أن يهطل المطر.", "نزل مطر / بتمطر", "nizil matar / bittmatir", "Both used.", "يمكن يتمطر بكرا.", ["weather"], "1", 133),
    ("v134", "verb", "to snow", "تَسَاقَطَ الثَّلْج", "tasaaqata aththalj", "ث ل ج", "تساقط الثلج على المرتفعات.", "نزل تلفان", "nizil talfaan", "Phrase in Lev.", "نزل تلفان عالجبال.", ["weather"], "2", 134),
    ("v135", "verb", "to shine (sun)", "أَشْرَقَ / يُشْرِقُ", "ashraqa / yushriqu", "ش ر ق", "أشرقت الشمس فجأة.", "طلعت الشمس", "tala'at esshams", "Phrase.", "الشمس طلعت فجأة.", ["weather"], "1", 135),

    # ── Colors ──
    ("n152", "noun", "red", "أَحْمَر", "ahmar", "ح م ر", "ارتدى معطفاً أحمر.", "أحمر", "ahmar", "Same.", "لبس جاكيت أحمر.", ["color"], "0+", 152),
    ("n153", "noun", "blue", "أَزْرَق", "azraq", "ز ر ق", "السماء زرقاء اليوم.", "أزرق", "azra'", "Same.", "السما زرقا اليوم.", ["color"], "0+", 153),
    ("n154", "noun", "green", "أَخْضَر", "akhdar", "خ ض ر", "الحديقة خضراء.", "أخضر", "akhDar", "Same.", "الجنينة خضرا.", ["color"], "0+", 154),
    ("n155", "noun", "yellow", "أَصْفَر", "asfar", "ص ف ر", "التاكسي أصفر.", "أصفر", "aSfar", "Same.", "التكسي أصفر.", ["color"], "0+", 155),
    ("n156", "noun", "black", "أَسْوَد", "aswad", "س و د", "السيارة سوداء.", "أسود", "aswad", "Same.", "السيارة سودا.", ["color"], "0+", 156),
    ("n157", "noun", "white", "أَبْيَض", "abyad", "ب ي ض", "الثلج أبيض.", "أبيض", "abyaD", "Same.", "التلفان أبيض.", ["color"], "0+", 157),
    ("n158", "noun", "brown", "بُنِّيّ", "bunniyy", "ب ن ي", "الباب بني.", "بني", "bunni", "Same.", "الباب بني.", ["color"], "1", 158),
    ("n159", "noun", "orange (color)", "بُرْتُقَالِيّ", "burtuqaaliyy", "ب ر ت", "القميص برتقالي.", "برتقاني", "burtu'aani", "Same.", "التيشرت برتقاني.", ["color"], "1", 159),
    ("n160", "noun", "purple", "بَنَفْسَجِيّ", "banafsajiyy", "ن ف س", "الزهرة بنفسجية.", "بنفسجي", "banafsaji", "Same.", "الزهرة بنفسجية.", ["color"], "1", 160),
    ("n161", "noun", "gray", "رَمَادِيّ", "ramaadiyy", "ر م د", "السماء رمادية.", "رمادي / كحلي", "ramaadi / kuhli", "رمادي common.", "السما رمادية.", ["color"], "1", 161),
    ("n162", "noun", "pink", "وَرْدِيّ", "wardiyy", "و ر د", "الفستان وردي.", "وردي", "wardi", "Same.", "الفستان وردي.", ["color"], "1", 162),
    ("n163", "noun", "gold (color)", "ذَهَبِيّ", "dhahabiyy", "ذ ه ب", "الإطار ذهبي.", "ذهبي", "dhahabi", "Same.", "الإطار ذهبي.", ["color"], "1+", 163),

    # ── News verbs ──
    ("v136", "verb", "to announce", "أَعْلَنَ / يُعْلِنُ", "a'lana / yu'linu", "أ ع ل ن", "أعلن الوزير النتائج في مؤتمر صحفي.", "أعلن / بيعلن", "a'lan / bi'lin", "Cognate.", "الوزير أعلن النتائج.", ["news"], "2", 136),
    ("v137", "verb", "to report (news)", "أَفَادَ / يُفِيدُ", "afada / yufeedu", "ف ي د", "أفادت وكالة الأنباء بوقوع الحادث.", "أفاد / بيفيد", "afad / bifid", "News register.", "الوكالة أفادت بالحادث.", ["news"], "3", 137),
    ("v138", "verb", "to confirm", "أَكَّدَ / يُؤَكِّدُ", "akkada / yu'akkidu", "ك د", "أكد المتحدث المعلومات.", "أكد / بيأكد", "akkad / bi'akkid", "Cognate.", "المتحدث أكد المعلومات.", ["news"], "2+", 138),
    ("v139", "verb", "to deny", "نَفَى / يَنْفِي", "nafa / yanfee", "ن ف ي", "نفى مسؤول الحكومة التقارير.", "نفى / بينفي", "nafa / binfi", "Cognate.", "المسؤول نفى الخبر.", ["news"], "2+", 139),
    ("v140", "verb", "to arrest", "أَلْقَى القَبْضَ عَلَى", "alqa alqabDa ala", "ق ب ض", "ألقت الشرطة القبض على المشتبه.", "قبضوا عليه", "qabadu 'alaih", "Phrase.", "الشرطة قبضت عليه.", ["news"], "2+", 140),
    ("v141", "verb", "to attack", "هَاجَمَ / يُهَاجِمُ", "hajama / yuhaajimu", "ه ج م", "هاجم مسلحون المبنى.", "هاجم / بيهاجم", "hajam / bihajim", "Cognate.", "مسلحين هاجموا المبنى.", ["news", "military"], "2+", 141),
    ("v142", "verb", "to resign", "اِسْتَقَالَ / يَسْتَقِيلُ", "istaqaala / yastaqeelu", "ق و ل", "استقال الوزير من منصبه.", "استقال", "istaa'al", "Same.", "الوزير استقال.", ["news", "politics"], "3", 142),
    ("v143", "verb", "to elect", "اِنْتَخَبَ / يَنْتَخِبُ", "intakhaba / yantakhibu", "خ ي ب", "انتخب الناخبون رئيساً جديداً.", "انتخبوا", "intakhabu", "Same.", "الناس انتخبوا رئيس جديد.", ["news", "politics"], "2+", 143),
    ("v144", "verb", "to protest", "اِحْتَجَّ / يَحْتَجُّ", "ihtajja / yahtajju", "ح ج ج", "احتج المتظاهرون على القرار.", "احتجوا / بيحتجوا", "ihtaju / biihtaju", "Cognate.", "المتظاهرين احتجوا.", ["news", "politics"], "2+", 144),
    ("v145", "verb", "to investigate", "حَقَّقَ / يُحَقِّقُ", "haqqaqa / yuhaqqiqu", "ح ق ق", "حققت الشرطة في الحادث.", "حققوا", "haqqu", "Same.", "الشرطة حققت بالحادث.", ["news"], "3", 145),
    ("v146", "verb", "to publish", "نَشَرَ / يَنْشُرُ", "nashara / yanshuru", "ن ش ر", "نشرت الصحيفة التقرير.", "نشر / بينشر", "nashar / beenashar", "Cognate.", "الصحيفة نشرت التقرير.", ["news"], "2", 146),
    ("v147", "verb", "to broadcast", "بَثَّ / يَبُثُّ", "baththa / yabuththu", "ب ث ث", "بث التلفزيون البيان مباشرة.", "بث / بيبث", "bath / beebs", "Cognate.", "التلفزيون بث الخبر.", ["news"], "2+", 147),
    ("v148", "verb", "to call for", "دَعَا إِلَى", "da'a ila", "د ع و", "دعا الناشطون إلى إصلاحات.", "دعوا لـ", "da'u la", "Phrase.", "الناشطين دعوا لإصلاحات.", ["news", "politics"], "3", 148),

    # ── News nouns ──
    ("n164", "noun", "statement (official)", "بَيَان", "bayaan", "ب ي ن", "أصدرت الوزارة بياناً رسمياً.", "بيان", "beyaan", "Same.", "الوزارة أصدرت بيان.", ["news"], "2+", 164),
    ("n165", "noun", "spokesman", "مُتَحَدِّث", "mutahaddith", "ح د ث", "قال المتحدث إن التحقيق مستمر.", "متحدث", "mutahaddis", "Same.", "المتحدث قال التحقيق مستمر.", ["news"], "3", 165),
    ("n166", "noun", "witness", "شَاهِد", "shaahid", "ش ه د", "أدلى الشاهد بشهادته.", "شاهد", "shaahid", "Same.", "الشاهد أدلى بشهادته.", ["news"], "2+", 166),
    ("n167", "noun", "casualty", "ضَحِيَّة", "dahiiyya", "ض ح ي", "وقعت ضحايا في الحادث.", "ضحية", "dahiiyye", "Same.", "في ضحايا بالحادث.", ["news"], "2+", 167),
    ("n168", "noun", "victim", "مَجْنِيّ عَلَيْه", "majniyy alayh", "ج ن ي", "أُصيب المجنى عليه بجروح.", "ضحية / مجني عليه", "dahiiyye", "ضحية common.", "الضحية انجرح.", ["news"], "2+", 168),
    ("n169", "noun", "suspect", "مُشْتَبَه", "mushtabah", "ش ب ه", "ألقي القبض على المشتبه به.", "مشتبه فيه", "mushtaba fih", "Same.", "قبضوا على المشتبه.", ["news"], "3", 169),
    ("n170", "noun", "press conference", "مُؤْتَمَر صَحَفِيّ", "mu'tamar sahafiyy", "م ر", "عُقد مؤتمر صحفي في الظهر.", "مؤتمر صحفي", "mu'tamar Sahafi", "Same.", "عملوا مؤتمر صحفي.", ["news"], "3", 170),
    ("n171", "noun", "headline", "عُنْوَان", "unwaan", "ع ن و", "تصدر العنوان الصفحات الأولى.", "عنوان", "'unwaan", "Same.", "العنوان على الأول.", ["news"], "2", 171),
    ("n172", "noun", "source (news)", "مَصْدَر", "masdar", "ص د ر", "أفادت مصادر مطلعة بذلك.", "مصدر", "maSdar", "Same.", "مصادر قالت.", ["news"], "3", 172),
    ("n173", "noun", "evidence", "دَلِيل / بُرْهَان", "daleel / burhaan", "د ل ل", "قدّمت النيابة أدلة جديدة.", "دليل / برهان", "daleel", "Same.", "النيابة قدمت أدلة.", ["news"], "3", 173),
    ("n174", "noun", "verdict", "حُكْم", "hukm", "ح ك م", "أصدر القاضي حكمه.", "حكم", "hukm", "Same.", "القاضي أصدر الحكم.", ["news", "politics"], "3", 174),
    ("n175", "noun", "trial", "مَحْكَمَة / مُحَاكَمَة", "mahkama / muhaakama", "ح ك م", "بدأت المحاكمة أمس.", "محاكمة", "muhaakame", "Same.", "المحاكمة بلشت امبارح.", ["news"], "3", 175),
    ("n176", "noun", "unrest", "اِضْطِرَاب", "idtiraab", "ض ر ب", "شهدت المدينة اضطرابات.", "اضطرابات", "idtirabaat", "Same.", "المدينة شهدت اضطرابات.", ["news", "politics"], "3", 176),
    ("n177", "noun", "cabinet (government)", "حُكُومَة / وَزَارَة", "hukuma / wazaara", "ح ك م", "اجتمعت الحكومة في جلسة طارئة.", "حكومة / وزارة", "hukume", "Same.", "الحكومة اجتمعت.", ["news", "politics"], "3", 177),
    ("n178", "noun", "breaking news", "خَبَر عاجِل", "khabar aajil", "خ ب ر", "نقلت القناة خبراً عاجلاً.", "خبر عاجل", "khabar 'aajil", "Same.", "القناة نقلت خبر عاجل.", ["news"], "2+", 178),

    # ── Death / obituary register (verbs + phrases) ──
    ("v149", "verb", "to die", "مَاتَ / يَمُوتُ", "mata / yamootu", "م و ت", "توفي الرئيس مساءً.", "مات / بيموت", "maat / bimoot", "Cognate.", "الرئيس مات بالليل.", ["death", "news"], "1", 149),
    ("v150", "verb", "to pass away (formal)", "وَفَى / يَفِي", "wafa / yafee", "و ف ي", "وُفّيَ الوزير السابق فجر اليوم.", "وفى", "wafa", "Formal.", "الوزير وفى الفجر.", ["death", "news"], "3", 150),
    ("v151", "verb", "to depart this life", "فَارَقَ الحَياة", "fariqa alhayaat", "ف ر ق", "فارق الحياة بعد معاناة طويلة.", "فارق الحياة", "fari' alhaya", "Same.", "فارق الحياة.", ["death", "news"], "3+", 151),
    ("v152", "verb", "to be martyred", "اِسْتُشْهِدَ", "istushhida", "ش ه د", "استشهد ثلاثة جنود في المعركة.", "استشهد", "istushhid", "Same.", "ثلاثة جنود استشهدوا.", ["death", "news", "military"], "3", 152),
    ("v153", "verb", "to be killed", "قُتِلَ", "qutila", "ق ت ل", "قُتل مدنيان في الانفجار.", "انقتل / قُتل", "in'atil", "Passive.", "مدنيين انقتلوا.", ["death", "news"], "2+", 153),
    ("v154", "verb", "to lose one's life", "فَقَدَ حَياتَه", "faqada hayaatahu", "ف ق د", "فقد حياته إثر الحادث.", "فقد حياته", "fa'ad hayaatu", "Same.", "فقد حياته بالحادث.", ["death", "news"], "3", 154),
    ("v155", "verb", "to drown", "غَرِقَ / يَغْرَقُ", "ghariqa / yaghraqu", "غ ر ق", "غرق طفلان في النهر.", "غرق / بيغرق", "ghari' / bighri'", "Cognate.", "طفلين غرقوا بالنهر.", ["death", "news"], "2", 155),
    ("p001", "phrase", "may God have mercy on him/her", "رَحِمَهُ الله / رَحِمَهَا الله", "rahimahu allah / rahimaha allah", "—", "رحمه الله، كان من خيرة العلماء.", "الله يرحمه / الله يرحمها", "allah yirhamu", "Common obit.", "الله يرحمه، كان من أحسن الناس.", ["death", "phrase"], "2+", 201),
    ("p002", "phrase", "passed away (euphemism)", "فَقَدَ الأَسْرَة فَقِيدَهَا", "faqadat al'usra faqeedaha", "—", "فقدت الأسرة فقيدها بعد صراع مع المرض.", "فقدوا غالي", "fa'adu ghali", "Lev obit.", "العيلة فقدت غاليها.", ["death", "phrase", "news"], "3", 202),
    ("p003", "phrase", "tragic death / painful loss", "وَفَاةٌ مُؤْلِمَة", "wafaatun mu'lima", "—", "بعد وفاة مؤلمة، نعى المسؤولون الضحية.", "وفاة مؤلمة", "wafa m'lima", "Same.", "بعد وفاة مؤلمة نعوا الضحية.", ["death", "phrase", "news"], "3+", 203),
    ("p004", "phrase", "martyrdom (news)", "اِسْتِشْهَاد", "istishhaad", "—", "أعلنت الوزارة استشهاد أربعة من أفرادها.", "استشهاد", "istishhaad", "Same.", "الوزارة أعلنت استشهاد أربعة.", ["death", "phrase", "news"], "3", 204),
    ("p005", "phrase", "funeral / burial", "دَفْن / تَشْيِيع", "dafn / tashyee'", "—", "شُيّع الجثمان بعد صلاة الجنازة.", "تشييع / دفن", "tashyee'", "Same.", "شيعوا الجثمان.", ["death", "phrase"], "2+", 205),
    ("p006", "phrase", "cause of death", "سَبَب الوَفَاة", "sabab alwafaat", "—", "أعلن الطبيب الشرعي سبب الوفاة.", "سبب الوفاة", "sabab elwafa", "Same.", "الطبيب أعلن سبب الوفاة.", ["death", "phrase", "news"], "3", 206),

    # ── Filler / discourse phrases ──
    ("p007", "phrase", "also / as well", "أَيْضاً / كَذٰلِك", "aydan / kadhalik", "—", "حضر الوزير، وأيضاً مستشاروه.", "كمان / كذلك", "kamaan / kadhalik", "كمان very common.", "الوزير حضر وكمان مستشارينه.", ["phrase", "discourse"], "1+", 207),
    ("p008", "phrase", "as well as", "إِضَافَةً إِلَى / بِالإِضَافَة إِلَى", "idafatan ila", "—", "شارك الوفد، بالإضافة إلى مراقبين دوليين.", "بالإضافة لـ", "bil'idafe la", "Same.", "الوفد حضر بالإضافة لمراقبين.", ["phrase", "discourse"], "2", 208),
    ("p009", "phrase", "finally / lastly", "أَخِيراً / أَخِيرَةً", "akhiran / akhiratan", "—", "أخيراً، أعلن الرئيس النتائج.", "أخيراً / بالأخير", "akhiran / bil'akhir", "Same.", "أخيراً الرئيس أعلن.", ["phrase", "discourse"], "1+", 209),
    ("p010", "phrase", "from time to time", "مِنْ وَقْتٍ لِآخَر", "min waqtin li'aakhar", "—", "يزورنا من وقت لآخر.", "من وقت لآخر", "min wa't la'akhar", "Same.", "بيزورنا من وقت لآخر.", ["phrase", "discourse"], "2", 210),
    ("p011", "phrase", "however", "مِعْذَلَةً / لَكِنَّ / غَيْرَ أَنَّ", "mi'dhalatan / lakinna", "—", "كان التقرير دقيقاً، لكن النتائج مفاجئة.", "بس / لكن", "bas / lakin", "بس colloquial.", "التقرير دقيق بس النتيجة مفاجئة.", ["phrase", "discourse"], "2+", 211),
    ("p012", "phrase", "moreover / furthermore", "فَضْلاً عَنْ ذٰلِك / إِضَافَةً لِذٰلِك", "fadlan an dhalik", "—", "ارتفعت الأسعار، فضلاً عن نقص الإمدادات.", "كمان / بالإضافة", "kamaan", "Same.", "الأسعار طالعة كمان في نقص.", ["phrase", "discourse"], "3", 212),
    ("p013", "phrase", "therefore", "لِذٰلِكَ / وَعْلَيْهِ", "lidhalika / wa'alayhi", "—", "تأخرت الطائرة، ولذلك غادرنا متأخرين.", "لهيك / عشان هيك", "laheik / 'ashaan heik", "Lev causal.", "الطيارة تأخرت عشان هيك.", ["phrase", "discourse"], "2+", 213),
    ("p014", "phrase", "nevertheless", "عَلَى أَيِّ حَال / مَعَ ذٰلِك", "ala ayyi haal / ma'a dhalik", "—", "على أي حال، سنواصل المفاوضات.", "مع هيك / على كل حال", "ma' heik", "Lev.", "مع هيك رح نكمل.", ["phrase", "discourse"], "3", 214),
    ("p015", "phrase", "meanwhile", "فِي ذٰلِكَ الوَقْت / فِي المُقَابِل", "fee dhalika alwaqt", "—", "في الوقت نفسه، اجتمع الوزراء.", "بنفس الوقت", "bnafs ilwa't", "Same.", "بنفس الوقت الوزراء اجتمعوا.", ["phrase", "discourse"], "2+", 215),
    ("p016", "phrase", "subsequently / after that", "بَعْدَ ذٰلِك / لَاحِقاً", "ba'da dhalik / laahiqan", "—", "بعد ذلك، أُعلن الاتفاق.", "بعدها / لاحقاً", "ba'dha", "Same.", "بعدها أعلنوا الاتفاق.", ["phrase", "discourse"], "2+", 216),
    ("p017", "phrase", "previously / earlier", "سَابِقاً / قَبْلَ ذٰلِك", "saabiqan / qabla dhalik", "—", "سبق أن ناقشنا الموضوع.", "قبل هيك / سابقاً", "'abbl heik", "Lev.", "ناقشنا الموضوع قبل هيك.", ["phrase", "discourse"], "2", 217),
    ("p018", "phrase", "currently / at present", "حَالِيّاً / فِي الوَقْت الحَالِي", "haaliyyan", "—", "الوضع حالياً تحت السيطرة.", "هلأ / حالياً", "halla' / haaliyyan", "هلأ common.", "الوضع هلأ تحت السيطرة.", ["phrase", "discourse"], "2", 218),
    ("p019", "phrase", "recently", "مُؤَخَّراً / فِي الآوَانِ الأَخِيرَة", "mu'akhkharan", "—", "شهدت المنطقة مؤخراً تصعيداً.", "مؤخراً / هالأيام", "mu'akhkharan", "Same.", "المنطقة شهدت تصعيد هالأيام.", ["phrase", "discourse"], "2+", 219),
    ("p020", "phrase", "often / frequently", "كَثِيراً / مِرَّاتٍ عَدِيدَة", "kathiran", "—", "كثيراً ما نسمع هذا التعبير.", "كتير / مرات كتيرة", "kteer", "Same.", "كتير منسمع هالحكي.", ["phrase", "discourse"], "1+", 220),
    ("p021", "phrase", "rarely / seldom", "نَادِراً", "naadiran", "—", "نادراً ما يحدث مثل هذا.", "نادراً / نادر", "naadir", "Same.", "نادر بصير هيك.", ["phrase", "discourse"], "2", 221),
    ("p022", "phrase", "approximately / about", "تَقْرِيباً / حَوَالَي", "taqreeban / hawaalay", "—", "بلغ عدد الضحايا تقريباً عشرين.", "تقريباً / حوالي", "taqreeban / hawaali", "Same.", "الضحايا تقريباً عشرين.", ["phrase", "discourse"], "2", 222),
    ("p023", "phrase", "especially / in particular", "خُصُوصاً / بِشَكْل خَاص", "khususan", "—", "تأثرت المدن الساحلية خصوصاً.", "خصوصاً / بشكل خاص", "khususan", "Same.", "المدن الساحلية تأثرت خصوصاً.", ["phrase", "discourse"], "2+", 223),
    ("p024", "phrase", "for example", "مِثلاً / عَلَى سَبِيل المِثَال", "mithlan", "—", "توجد عدة خيارات، مثلاً التأجيل.", "مثلاً / على سبيل المثال", "masalan", "Same.", "في خيارات مثلاً التأجيل.", ["phrase", "discourse"], "1+", 224),
    ("p025", "phrase", "that is to say / i.e.", "أَي / يُقَال لَه", "ay / yuqaal lahu", "—", "الاجتماع غداً، أي يوم الثلاثاء.", "يعني / أي", "ya'ni / ay", "يعني in speech.", "الاجتماع بكرا يعني يوم الثلاثاء.", ["phrase", "discourse"], "2+", 225),
    ("p026", "phrase", "on the other hand", "مِن نَاحِيَةٍ أُخْرَى", "min naahiyatin ukhra", "—", "من ناحية أخرى، الوضع الأمني هادئ.", "من ناحية تانية", "min naahi tanya", "Same.", "من ناحية تانية الوضع هادي.", ["phrase", "discourse"], "3", 226),
    ("p027", "phrase", "in conclusion", "خِتاماً / لِلخَتَام", "khitaaman", "—", "ختاماً، نؤكد التزامنا بالاتفاق.", "بالختام / ختاماً", "bilkhtam", "Same.", "بالختام منأكد التزامنا.", ["phrase", "discourse"], "3", 227),
    ("p028", "phrase", "first of all", "أَوَّلاً / قَبْلَ كُلِّ شَيْء", "awwalan", "—", "أولاً، نشكر الحضور.", "أول شي / أولاً", "awwal shi", "Lev.", "أول شي منشكر الحضور.", ["phrase", "discourse"], "1+", 228),
    ("p029", "phrase", "then / next", "ثُمَّ / بَعْدَ ذٰلِك", "thumma", "—", "ناقشوا الموضوع، ثم اتخذوا القرار.", "بعدين / ثم", "ba'deen", "Same.", "ناقشوا وبعدين قرروا.", ["phrase", "discourse"], "1+", 229),
    ("p030", "phrase", "at the same time", "فِي الوَقْت نَفْسِه", "fee alwaqt nafsihi", "—", "في الوقت نفسه، بدأ التصعيد.", "بنفس الوقت", "bnafs ilwa't", "Same.", "بنفس الوقت بلش التصعيد.", ["phrase", "discourse"], "2+", 230),
    ("p031", "phrase", "despite / in spite of", "عَلَى الرَّغْم مِن / رَغْمَ", "ala arraghm min", "—", "على الرغم من التحذيرات، استمرت الاحتجاجات.", "رغم / على رغم", "raghm", "Same.", "رغم التحذيرات الاحتجاجات استمرت.", ["phrase", "discourse"], "3", 231),
    ("p032", "phrase", "because of / due to", "بِسَبَب / نَتِيجَةً لِ", "bisabab / natijatan li", "—", "أُلغيت الرحلة بسبب العاصفة.", "بسبب / عشان", "bsabab / 'ashaan", "Same.", "الرحلة انلغت بسبب العاصفة.", ["phrase", "discourse"], "2", 232),
    ("p033", "phrase", "regarding / concerning", "بِخُصُوص / فِيما يَتَعَلَّق بِ", "bikhusus", "—", "فيما يتعلق بالاقتصاد، الوضع صعب.", "بخصوص / فيما يخص", "bikhusus", "Same.", "بخصوص الاقتصاد الوضع صعب.", ["phrase", "discourse"], "3", 233),
    ("p034", "phrase", "according to", "وَفْقاً لِ / حَسَبَ", "wafqan li / hasaba", "—", "وفقاً للتقرير، ارتفعت الأسعار.", "حسب / وفقاً لـ", "hasab / waf'an la", "Same.", "حسب التقرير الأسعار طالعة.", ["phrase", "discourse"], "2+", 234),
    ("p035", "phrase", "it should be noted that", "يَجِب الإِشَارَة إِلَى أَنَّ", "yajibu al'ishaarat ila anna", "—", "يجب الإشارة إلى أن الأرقام أولية.", "لازم ننوه إنه", "laazim ninnawih", "News style.", "لازم ننوه إنو الأرقام أولية.", ["phrase", "discourse", "news"], "3+", 235),
    ("p036", "phrase", "reportedly / according to reports", "حَسَبَ ما يُنْشَر / يُقَال", "hasaba ma yunshar", "—", "حسب ما ينشر، وقع اشتباك جديد.", "حسب ما بيقولوا / يقال", "hasab ma bi'ulu", "Same.", "حسب ما بيقولوا صار اشتباك.", ["phrase", "discourse", "news"], "3+", 236),
    ("p037", "phrase", "sources said", "أَفَادَت مَصَادِر", "afadat masaadir", "—", "أفادت مصادر أن الاجتماع تأجل.", "مصادر أفادت", "masadir afadat", "Same.", "مصادر أفادت إنو الاجتماع تأجل.", ["phrase", "discourse", "news"], "3+", 237),
    ("p038", "phrase", "in addition", "إِضَافَةً لِذٰلِك", "idafatan lidhalik", "—", "إضافة لذلك، فرضت عقوبات جديدة.", "بالإضافة لذلك", "bil'idafe lidhalik", "Same.", "بالإضافة لذلك فرضوا عقوبات.", ["phrase", "discourse"], "2+", 238),
    ("p039", "phrase", "in fact / actually", "فِعْلاً / في الحَقِيقَة", "fi'lan / filhaqiqa", "—", "في الحقيقة، الأمر أعقد مما يبدو.", "بالحقيقة / فعلاً", "bilha'ii'a", "Same.", "بالحقيقة الموضوع أعقد.", ["phrase", "discourse"], "2", 239),
    ("p040", "phrase", "in general", "بِشَكْل عَام / عُمُوماً", "bishakl aam", "—", "بشكل عام، الوضع مستقر.", "بشكل عام / عموماً", "bishakl 'aam", "Same.", "بشكل عام الوضع مستقر.", ["phrase", "discourse"], "2+", 240),
    ("p041", "phrase", "suddenly", "فَجْأَةً", "faj'atan", "—", "فجأة، انقطع التيار الكهربائي.", "فجأة / بفجأة", "faj'a / bfaj'a", "Same.", "فجأة انقطع الكهربا.", ["phrase", "discourse"], "1+", 241),
    ("p042", "phrase", "immediately", "فَوْراً / حَالاً", "fawran / haalan", "—", "تم إرسال الفرق فوراً.", "فوراً / على طول", "fawran / 'ala Tul", "Same.", "بعثوا الفرق فوراً.", ["phrase", "discourse"], "2", 242),
]


def make_item(t):
    id_, typ, eng, msa_f, msa_t, root, msa_ex, lev_f, lev_t, lev_n, lev_ex, tags, dlpt, rank = t
    item = {
        "id": id_,
        "type": typ,
        "english": eng,
        "dlpt_level": dlpt,
        "msa": {
            "form": msa_f,
            "translit": msa_t,
            "example": msa_ex,
        },
        "lev": {
            "form": lev_f,
            "translit": lev_t,
            "notes": lev_n,
            "example": lev_ex,
        },
        "tags": tags,
        "frequency_rank": rank,
    }
    if root and root != "—":
        item["msa"]["root"] = root
    return item


def main():
    path = Path("vocab.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    existing = {i["id"] for i in data["items"]}
    added = 0
    for t in NEW:
        if t[0] in existing:
            continue
        data["items"].append(make_item(t))
        added += 1
    verbs = sum(1 for i in data["items"] if i["type"] == "verb")
    nouns = sum(1 for i in data["items"] if i["type"] == "noun")
    phrases = sum(1 for i in data["items"] if i["type"] == "phrase")
    data["_meta"]["counts"] = {"verbs": verbs, "nouns": nouns, "phrases": phrases, "total": len(data["items"])}
    data["_meta"]["description"] = (
        "Arabic DrillForge vocabulary. Types: verb, noun, phrase. "
        "Fields: id, type, english, msa/lev objects, tags, dlpt_level, frequency_rank."
    )
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Added {added} items. Total: {len(data['items'])} (verbs {verbs}, nouns {nouns}, phrases {phrases})")


if __name__ == "__main__":
    main()