# Auto Next Lecture

콜로소(coloso.co.kr) 강의 페이지에서 쓰는 개인용 크롬 확장 프로그램입니다.

## 기능

- 영상이 끝나면 3초 카운트다운(취소 가능) 뒤 하단 **다음 코스** 버튼을 누릅니다.
- "이전 재생 위치부터 재생하시겠습니까?" 팝업에서 **예**를 자동으로 누릅니다.
- 팝업에서 재생 속도(0.5x ~ 2.0x)를 고르면 Kollus 플레이어에 계속 적용합니다.

> 콜로소 FAQ에 따르면 배속 재생, 건너뛰기, 이어보기는 진도율에 반영되지 않을 수 있습니다.

## 설치

### 1. 코드 받기

비공개 저장소라 저장소 접근 권한이 있는 GitHub 계정으로 로그인한 상태여야 합니다.

**방법 A. ZIP으로 받기 (git 없이)**

1. 저장소 페이지에서 초록색 **Code** 버튼 → **Download ZIP**을 누릅니다.
2. 받은 ZIP 파일의 압축을 풉니다. (예: `C:\Users\<사용자>\auto-next-lecture-main`)

**방법 B. git으로 받기**

```sh
git clone https://github.com/HyeonSuuuuu/auto-next-lecture.git
```

GitHub CLI가 있다면 `gh repo clone HyeonSuuuuu/auto-next-lecture`도 됩니다.

### 2. 크롬에 설치

1. 크롬 주소창에 `chrome://extensions`를 입력합니다.
2. 오른쪽 위 **개발자 모드**를 켭니다.
3. 왼쪽 위 **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
4. 받은 폴더(`manifest.json`이 들어 있는 폴더)를 선택합니다.
5. 툴바의 퍼즐 조각(🧩) 아이콘에서 **Auto Next Lecture**를 고정(📌)하면 설정 팝업을 쉽게 열 수 있습니다.

### 3. 업데이트

1. 새 코드를 받습니다. ZIP은 다시 받아 같은 폴더에 덮어쓰고, git은 폴더에서 `git pull`을 실행합니다.
2. `chrome://extensions`에서 확장 카드의 ↻를 누릅니다.
3. 열려 있는 콜로소 강의 탭을 새로고침(F5)합니다.

ZIP을 다른 폴더에 풀었다면 기존 확장을 삭제하고 새 폴더로 다시 로드해야 합니다.

## 구조

| 파일 | 역할 |
|---|---|
| `content.js` | 영상 종료 감지, 다음 버튼 클릭, 이어보기 팝업 처리 (콜로소 + Kollus iframe) |
| `main.js` | 콜로소 페이지의 Kollus 컨트롤러(`VgControllerClient`)로 재생 속도 변경 |
| `background.js` | Kollus iframe의 영상 종료 신호를 콜로소 페이지로 전달 |
| `popup.html/js` | 자동 넘김 켜기/끄기, 재생 속도 선택 |

콜로소나 Kollus의 화면 구조가 바뀌면 동작하지 않을 수 있습니다.
