---
layout: post
title: private한 @Published에 대한 고민
author: Celan
categories: SwiftUI
---

### SwiftUI, @State, 그리고 @Published

SwiftUI는 선언형 UI를 빠르고 안정적으로 처리하기 위해 구조체, 즉 값 타입을 기반으로 `State`를 관리한다.
SwiftUI의 `View`는 구조체 타입을 갖기 때문에, mutation을 위한 추가적인 장치가 필요하다.
내부의 속성들을 편리하게 mutate할 수단으로서 `@State` 프로퍼티 래퍼가 등장했다.
수 많은 `@State`를 하나의 객체에서 처리하고 관리하기 위해 `ObservableObject` 프로토콜이 `Combine`의 `Publisher` 개념을 차용하여 도입되었다.
MVVM 아키텍쳐에 익숙한 나는 자연스럽게 `ObservableObject`를 채택한 `ViewModel` 클래스 내부에 `@Published` 속성들을 선언하곤 했다.
그러나 이 속성들이 `View`에서 직접 참조가 가능한 이 상황이 외부에서의 mutation에도 취약하다는 사실을 깨닫기까지 긴 시간이 걸렸다.
내가 선언한 모든 `@Published`가 `public`하기 때문이었다.

### 위에서 발견한 문제들

그럼 더 이상 `public`하지 않은 `@Published`를 두면 되지 않겠는가?
각 속성에 대한 write 메소드를 따로 정리하고, 외부에서는 read만 할 수 있도록 수정해 본다.

```swift
final class MyViewModel: ObservableObject {
    @Published private(set) var myName: String = ""
    @Published private(set) var myAge: Int = 0

    // init() { }

    public func myNameSetter(_ name: String) {
        self.myName = name
    }

    public func myAgeSetter(_ age: Int) {
        self.myAge = age
    }
}
```

이렇게 써놓고 봐도 시원하지가 않았다.
문제 상황을 어설프게 해결했다는 생각이 든다.

**[여전히 남은 문제 상황들]**
- 객체의 속성이 엄밀하게 `private` 한가?
- 무엇보다 속성들이 많아질수록 `setter`도 많아지고, 공간 복잡도가 커지는 괴물 객체가 탄생하지는 않나?

문제를 해결했다고는 했지만.. 여전히 다른 문제를 야기할 수 있을 것 같다는 생각을 한다.
이 생각은 몇 달 전부터 들었으나 해결을 위해 뾰족한 수를 찾지 못하고 있었다.
그 사이, 나는 The Composable Architecture의 한국어 e-book 집필을 마무리하고, swift-evolution에 대한 발표를 Let'Swift 2023에서 진행했다.
불현듯 이 문제를 더 정교하게 해결할 수 있겠다는 생각을 했다.
머릿속에서 제너릭, 프로토콜, `@State`를 관리하는 TCA의 방식, 그리고 간접 접근 방식 등을 활용하는 아이디어가 떠올랐다.

### 더 나은 private @Published

내가 떠올린 해결책의 첫 단추는 `KeyPath`였다.
가장 Swift스러운 기능 중 하나라고 생각하는 KVC(key-value coding)는 objc 시절부터 내려온 전통(?)있는 간접 접근 방식이다.
특정 객체에 문자열로 된 key를 전달하여 그 value를 반환받는 간접 접근 방식은 딕셔너리의 아이디어와 유사하다.
objc 시절에는 `NSObject`를 준수하는 클래스 타입만이 간접 접근 방식을 구현할 수 있었는데, Swift로 넘어오면서 `KeyPath`라는 새로운 타입이 소개되었다.
이 타입은 2개의 타입 파라미터를 요구한다.
하나는 간접적으로 접근하고자 하는 **"객체의 타입"** 다른 하나는 객체에서 접근할 **"속성의 타입"**이다.
그 활용은 이러하다.

```swift
final class MyViewModel: ObservableObject {
    @Published private var myName: String = "name"
    
    public func getmyName(keyPath: KeyPath<MyStruct, String>) -> String {
        return myName
    }
}

let myStruct = MyStruct()
let myString = myStruct.getmyName(keyPath: \.myName)
print(myString) // "name"

```

이 방식으로 `private` 한 속성에 대한 간접 접근이 가능하다.
그러나 속성이 늘어날 때마다 메소드의 공간 복잡도도 함께 커지는 문제는 여전히 남아있다.
아, 아직 속성에 대한 업데이트도 구현되어있지 않다.
공간 복잡도와 private 속성에 대한 업데이트를 동시에 해결하기 위해 나는 제너릭을 도입해본다.
접근 방식은 이러하다.

1. 어떤 타입의 속성에 접근할지는 호출하는 시점에 결정한다.
2. 각 속성의 타입이 서로 다른 점에 착안하여 일관된 프로토콜(ex. `Equatable`)에 의해 제약된 제너릭 타입을 제안한다.
3. update는 `KeyPath`의 또 다른 형태인 `WritableKeyPath`를 활용한다.
4. 호출하는 시점에, `WritableKeyPath`에 전달되는 타입 파라미터에 의해 update하는 값의 타입 추론이 가능하다.

이제 코드 스니펫은 더 많은 타입을 갖고 있는 ViewModel을 표현하게 된다.

```swift
final class MyViewModel: ObservableObject {
    struct Book {
        var title: String
        var isReadCompleted: Bool
    }
    
    @Published private var myName: String = "name"
    @Published private var myAge: Int = 0
    @Published private var myBooks: [Book] = []
    
    public func getMyProperties<Value: Equatable>(
        _ keyPath: KeyPath<MyViewModel, Value>
    ) -> Value {
        switch keyPath {
        /*
        get 하는 시점에 추가적인 로직이 필요하다면, case로 분기처리할 수 있다.
        case \.myName: return self[keyPath: keyPath] + "!"
        */ 
        default:
            return self[keyPath: keyPath]
        }
    }
    
    public func updateMyProperties<Value: Equatable>(
        _ keyPath: WritableKeyPath<MyViewModel, Value>,
        with newValue: Value
    ) {
        switch keyPath {
        /*
        마찬가지로, update하는 시점에 추가적인 로직이 필요하다면, case로 분기처리할 수 있다.
        case \.myName: 
        withAnimation {
            self[keyPath: keyPath] = newValue
        }
        */ 
        default:
            self[keyPath: keyPath] = newValue
        }
    }
}
```

이렇게 하면 모든 속성에 대한 업데이트와 접근이 하나의 메소드로 정리된 것 같다.
아쉽게도... 이 형태는 컴파일이 되지 않는다.
`self`는 클래스인 `MyViewModel` 인데, 이 녀석은 immutable하기 때문이다.
이 시점에서 각 `@Published` 속성을 관리하는 단일한 구조체를 활용해본다.
`default` 가 모든 로직에 대응 가능하다면, 아래처럼 `switch`도 제거할 수 있다.
이 아이디어는 TCA에서 차용한 것이다.

```swift
final class MyViewModel: ObservableObject {
    struct Book: Equatable {
        var title: String
        var isReadCompleted: Bool
    }
    
    struct ViewState: Equatable {
        var myName: String = "name"
        var myAge: Int = 0
        var myBooks: [Book] = []
    }
    
    @Published private var viewState: ViewState
    
    init(viewState: ViewState) {
        self.viewState = viewState
    }
    
    public func getMyProperties<Value: Equatable>(
        _ keyPath: KeyPath<MyViewModel.ViewState, Value>
    ) -> Value {
        return self.viewState[keyPath: keyPath]
    }
    
    public func updateMyProperties<Value: Equatable>(
        _ keyPath: WritableKeyPath<MyViewModel.ViewState, Value>,
        with newValue: Value
    ) {
        self.viewState[keyPath: keyPath] = newValue
    }
}

let myViewModel = MyViewModel(viewState: .init())
myViewModel.updateMyProperties(\.myName, with: "Hi")
print(myViewModel.getMyProperties(\.myName)) // "Hi"
```

이 시점에서 나는 단 2개의 메소드로 `@Published`를 완전히 `private`하게 캡슐화하면서도 SwiftUI의 렌더링에 방해되지 않는 형태를 구현했다.
그러나 여전히 불만이 있는데, 업데이트를 하는 로직을 외부에서 호출할 수 있다는 점이다.
무엇보다 단일한 메소드가 모든 업데이트를 책임지기 때문에 **메소드의 이름이 충분히 시맨틱하지 않다**.
속성에 대해 간접 접근하여 read하는 `getMyProperties(_:)` 메소드도 마찬가지이다.
나는 속성을 가져오는 메소드의 이름을 아예 생략할 수 있다고 생각했고, 그 편이 더 호출하는 쪽에서 쉬울 것이라 생각했다.
따라서 `getMyProperties(_:)` 메소드는 `callAsFunction(_:)`으로 대체했다.
또한 `View`에서 `ViewModel`에 update를 요청하는 로직을 액션 단위로 나누어서 시맨틱하지 않은 update 메소드 문제를 해결할 수 있다.

```swift
/* ViewModel */
public func callAsFunction<Value: Equatable>(_ keyPath: KeyPath<MyViewModel.ViewState, Value>) -> Value {
    self.viewState[keyPath: keyPath]
}

public func onMyNameChanged(_ str: String) {
    self.updateMyProperties(\.myName, with: str)
}

/* View */

Text(myViewModel(\.myName))
    .font(.title3)
    .onChange(of: myViewModel(\.myName)) {
        myViewModel.onMyNameChanged($0)
    }

```

### 마치며

아쉽게도.. 위의 형태가 아무런 문제가 없는 완전한 형태인지 확답을 내리지 못했다.
경우에 따라서 나는 `MyViewModel`이 갖고 있는 `ViewState` 타입 자체가 완전히 다른 객체에 있어도 좋다고 생각한다.
모든 `State` 타입을 관리하는 Container가 있다면 부모-자식 간 State의 전달에도 유용할 것이라 생각하는데, 아마 이 생각이 발전되면 TCA가 되는 것 아닐까 싶다.
그리고 간접 접근 방식이 남발되는 형태는 팀원과 여러 방향으로 논의를 해봐야 한다고 생각한다.
괜히 `inout` 처럼 값 타입에 접근하는 시점이 꼬이면 앱이 터지는 건 아닌지 고민스럽다.
SwiftUI가 기본으로 제공하는 `ForEach()` 도 `KeyPath`를 활용하니까 괜찮다고 판단하고 있다.

2023.10.29. 일요일