import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebView as WebViewType } from 'react-native-webview';
import type { ParsedData } from '@/utils/jwxtParser';

const NWPU_URL = 'https://ecampus.nwpu.edu.cn/';

const PAGE_READY_SCRIPT = `
(function() {
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('PAGE_LOADED');
      }
    }, 2000);
  });
})();
true;
`;

const EXTRACT_DATA_SCRIPT = `
(function() {
  setTimeout(function() {
    try {
      var targetDoc = document;
      var iframes = document.querySelectorAll('iframe');
      for (var i = 0; i < iframes.length; i++) {
        try {
          var doc = iframes[i].contentDocument;
          if (doc && doc.body) {
            var text = doc.body.innerText || doc.body.textContent || '';
            if (text.indexOf('课程') >= 0 || text.indexOf('学分') >= 0) {
              targetDoc = doc;
              break;
            }
          }
        } catch(e) {}
      }

      var semesters = [];
      var semSelect = targetDoc.querySelector('#semesters');
      if (semSelect) {
        var options = semSelect.querySelectorAll('option');
        for (var j = 0; j < options.length; j++) {
          semesters.push({ name: options[j].textContent.trim(), dataSemester: options[j].value });
        }
      }
      if (semesters.length === 0) {
        semesters.push({ name: '2025-2026春', dataSemester: '2025-2026-2' });
      }

      var courses = [];
      var trs = targetDoc.querySelectorAll('tr');
      var currentDataSemester = semesters.length > 0 ? semesters[0].dataSemester : '';

      for (var k = 0; k < trs.length; k++) {
        var tr = trs[k];
        if (tr.getAttribute('data-semester')) {
          currentDataSemester = tr.getAttribute('data-semester');
        }

        var name = '';
        var showSched = tr.querySelector('.showSchedules');
        if (showSched) {
          name = showSched.textContent.trim();
        }
        if (!name) {
          var h3 = tr.querySelector('h3');
          if (h3) name = h3.textContent.trim();
        }
        if (!name) {
          var bodyText = tr.textContent || '';
          if (bodyText.indexOf('学分(') >= 0 && bodyText.length > 20) {
            var h3b = tr.querySelector('h3');
            if (h3b) name = h3b.textContent.trim();
            else {
              var p = tr.querySelector('p,td');
              if (p) name = p.textContent.trim().split(/[,\\n]/)[0];
            }
          }
        }
        if (name.length < 2) continue;

        var codeMatch = tr.innerHTML.match(/\\[([A-Za-z0-9]+)\\]/);
        var creditsMatch = tr.innerHTML.match(/学分\\(([\\d.]+)\\)/);
        var teacherMatch = tr.innerHTML.match(/(?:授课教师|教师)[：:]([^<]+)/);
        var assessmentMatch = tr.innerHTML.match(/(考试|考察)/);

        var scheduleText = '';
        var location = '';
        var tds = tr.querySelectorAll('td');
        for (var m = 0; m < tds.length; m++) {
          var tdText = (tds[m].textContent || '').replace(/\\s+/g, ' ').trim();
          if (tdText.indexOf('第') >= 0 && (tdText.indexOf('节') >= 0 || tdText.indexOf('周') >= 0)) {
            scheduleText = tdText;
          }
          if (tdText.indexOf('校区') >= 0 || tdText.indexOf('楼') >= 0 || tdText.indexOf('教室') >= 0) {
            location = tdText;
          }
        }

        if (!scheduleText) {
          var allTds = [];
          for (var n = 0; n < tds.length; n++) {
            allTds.push((tds[n].textContent || '').trim());
          }
          scheduleText = allTds.slice(-2).join(' ') || tr.innerHTML.replace(/<[^>]+>/g, '');
        }

        if (scheduleText.indexOf('网课') >= 0) continue;

        courses.push({
          name: name,
          code: codeMatch ? codeMatch[1] : undefined,
          credits: creditsMatch ? parseFloat(creditsMatch[1]) : undefined,
          teacher: teacherMatch ? teacherMatch[1].trim() : undefined,
          assessmentMethod: assessmentMatch ? assessmentMatch[1] : undefined,
          scheduleText: scheduleText,
          location: location || undefined,
          dataSemester: currentDataSemester
        });
      }

      if (courses.length === 0) {
        var h3Regex = /<h3[^>]*>([^<]+)<\\/h3>/g;
        var showSchedRegex = /class=["'][^"']*showSchedules[^"']*["'][^>]*>([^<]+)/g;
        var found = {};
        var match;
        while ((match = h3Regex.exec(targetDoc.body.innerHTML)) !== null) {
          if (match[1].trim().length >= 2) found[match[1].trim()] = true;
        }
        while ((match = showSchedRegex.exec(targetDoc.body.innerHTML)) !== null) {
          if (match[1].trim().length >= 2) found[match[1].trim()] = true;
        }
        for (var fname in found) {
          courses.push({ name: fname, scheduleText: '1-16周 周一 第1-2节' });
        }
      }

      var result = JSON.stringify({ semesters: semesters, courses: courses });
      window.ReactNativeWebView.postMessage('DATA_EXTRACTED:' + result);
    } catch(err) {
      window.ReactNativeWebView.postMessage('ERROR:' + err.message);
    }
  }, 4000);
})();
true;
`;

interface Props {
  onDataExtracted: (data: ParsedData) => void;
  onError: (message: string) => void;
}

export function JwxtWebView({ onDataExtracted, onError }: Props) {
  const theme = useTheme();
  const webViewRef = useRef<WebViewType>(null);
  const [canExtract, setCanExtract] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const handleMessage = (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    if (data === 'PAGE_LOADED') {
      setCanExtract(true);
      return;
    }
    if (data.startsWith('DATA_EXTRACTED:')) {
      setExtracting(false);
      try {
        const parsed = JSON.parse(data.slice('DATA_EXTRACTED:'.length));
        onDataExtracted(parsed as ParsedData);
      } catch {
        onError('数据解析失败');
      }
      return;
    }
    if (data.startsWith('ERROR:')) {
      setExtracting(false);
      onError(data.slice('ERROR:'.length));
    }
  };

  const handleExtract = () => {
    if (!canExtract || extracting) return;
    setExtracting(true);
    webViewRef.current?.injectJavaScript(EXTRACT_DATA_SCRIPT);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.toolbar}>
        <Text variant="labelLarge">
          {canExtract ? '页面已加载，请先登录教务系统并导航到课表页面' : '加载中...'}
        </Text>
        <Button
          mode="contained"
          onPress={handleExtract}
          disabled={!canExtract || extracting}
          loading={extracting}
        >
          提取课程
        </Button>
      </View>
      <WebView
        ref={webViewRef}
        source={{ uri: NWPU_URL }}
        onMessage={handleMessage}
        injectedJavaScriptBeforeContentLoaded={PAGE_READY_SCRIPT}
        style={styles.webview}
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  webview: {
    flex: 1,
  },
});

export default JwxtWebView;
