import React, { useEffect, useRef, useState } from 'react';

import { ApplicationTopic } from './ApplicationTopic';

interface TopicsListProps {
  topics: string[];
}

export const TopicsList: React.FC<TopicsListProps> = ({ topics }) => {
  const [overflowCount, setOverflowCount] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Эта функция проверяет, сколько элементов переполняют контейнер
  const checkOverflow = () => {
    if (containerRef.current) {
      let count = 0;
      const children = Array.from(containerRef.current.children); // Получаем только элементы
      const containerWidth = containerRef.current.offsetWidth;

      console.log('Container Width:', containerWidth);

      children.forEach((childNode: Element) => {
        const element = childNode as HTMLElement;
        console.log('Child Element Width:', element.offsetWidth);

        // Проверяем, если элемент выходит за пределы контейнера
        if (element.offsetLeft + element.offsetWidth > containerWidth) {
          count++;
        }
      });

      console.log('Overflow Count:', count);
      setOverflowCount(count);
    }
  };

  // Запуск checkOverflow при монтировании компонента и изменении списка топиков
  useEffect(() => {
    checkOverflow();
  }, [topics]);

  // Обновляем при изменении размера окна
  useEffect(() => {
    window.addEventListener('resize', checkOverflow);
    return () => {
      window.removeEventListener('resize', checkOverflow);
    };
  }, []);

  return (
    <div className="flex shrink-0 gap-2" ref={containerRef}>
      {/* Отображаем только видимые топики */}
      {topics.slice(0, topics.length - overflowCount).map((topic) => (
        <ApplicationTopic key={topic} topic={topic} />
      ))}

      {/* Отображаем количество скрытых топиков */}
      {overflowCount > 0 && (
        <span className="border border-accent-primary px-2 py-1">
          +{overflowCount}
        </span>
      )}
    </div>
  );
};
