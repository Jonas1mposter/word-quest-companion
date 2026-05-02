
-- Words tables: only admins can write
CREATE POLICY "Admins manage words" ON public.words
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage math words" ON public.math_words
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage science words" ON public.science_words
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Class assignments: teachers manage their own
CREATE POLICY "Teachers manage own class assignments" ON public.class_assignments
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher')
    AND auth.uid() = teacher_id
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'teacher')
    AND auth.uid() = teacher_id
  );

-- Class competitions: teachers manage their own
CREATE POLICY "Teachers manage own class competitions" ON public.class_competitions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher')
    AND auth.uid() = teacher_id
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'teacher')
    AND auth.uid() = teacher_id
  );
